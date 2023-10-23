const express = require('express');
const bodyParser = require('body-parser');
const { sequelize, Profile, Contract, Job } = require('./model');
const { getProfile } = require('./middleware/getProfile');
const { Op } = require('sequelize'); // Import Operators from sequelize
const cors = require('cors');
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.set('sequelize', sequelize);
app.set('models', sequelize.models);



/**
 * FIX ME!
 * @returns contract by id
 */
app.get('/contracts/:id', getProfile, async (req, res) => {
    try {
        const { id } = req.params;
        const { profile } = req;

        const contract = await Contract.findOne({ where: { id } });

        if (!contract) return res.status(404).end();

        if (contract.ClientId !== profile.id && contract.ContractorId !== profile.id) {
            return res.status(403).json({ error: 'Unauthorized access to the contract' });
        }

        res.json(contract);
    } catch (error) {
        console.error('Error fetching contract: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/contracts', getProfile, async (req, res) => {
    const { profile } = req;
    try {
        // Find all contracts where the client or contractor is the authenticated user's profile
        const contracts = await Contract.findAll({
            where: {
                status: {
                    [Op.not]: 'terminated',
                },
                [Op.or]: [{ ClientId: profile.id }, { ContractorId: profile.id }],
            },
        });

        // Return the list of contracts
        res.json(contracts);
    } catch (error) {
        console.error('Error fetching contracts: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/jobs/unpaid', getProfile, async (req, res) => {
    const { profile } = req;
    try {
        // Find all unpaid jobs for the user from active contracts
        const jobs = await Job.findAll({
            where: {
                paid: false, // Filter for unpaid jobs
            },
            include: {
                model: Contract,
                where: {
                    status: 'in_progress', // Filter for active contracts
                    [Op.or]: [{ ClientId: profile.id }, { ContractorId: profile.id }], // Filter for user's active contracts
                },
            },
        });

        res.json(jobs);
    } catch (error) {
        console.error('Error fetching unpaid jobs: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/jobs/:job_id/pay', getProfile, async (req, res) => {
    const { profile } = req;
    const { job_id } = req.params;

    try {
        // Find the job by ID
        const job = await Job.findByPk(job_id, {
            include: {
                model: Contract,
                include: [{ model: Profile, as: 'Client' }, { model: Profile, as: 'Contractor' }],
            },
        });

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        // Check if the job is already paid
        if (job.paid) {
            return res.status(400).json({ error: 'Job is already paid' });
        }

        const client = job.Contract.Client;
        const contractor = job.Contract.Contractor;

        // Check if the client's balance is sufficient for payment
        if (client.balance < job.price) {
            return res.status(400).json({ error: 'Client balance is insufficient for payment' });
        }

        // Update the job's payment status
        job.paid = true;
        job.paymentDate = new Date();
        await job.save();

        // Transfer the amount from the client's balance to the contractor's balance
        client.balance -= job.price;
        contractor.balance += job.price;
        await client.save();
        await contractor.save();

        res.json({ message: 'Job payment successful' });
    } catch (error) {
        console.error('Error paying for job: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/balances/deposit/:userId', getProfile,async (req, res) => {
    const { profile } = req;
    const { userId } = req.params;
    const { amount } = req.body;

    try {
        const client = await Profile.findOne({ where: { id: userId, type: 'client' } });

        if (!client) {
            return res.status(404).json({ error: 'Client not found' });
        }

        // Calculate the 25% of the total jobs to pay for the client
        const twentyFivePercent = client.balance * 0.25;

        // Check if the deposited amount exceeds 25% of the total jobs to pay for the client
        if (amount > twentyFivePercent) {
            return res.status(400).json({ error: 'Deposited amount exceeds 25% of the total jobs to pay' });
        }

        // Update the client's balance with the deposited amount
        client.balance += amount;
        await client.save();

        res.json({ message: 'Deposit successful' });
    } catch (error) {
        console.error('Error depositing money: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/admin/best-profession', getProfile, async (req, res) => {
    const { start, end } = req.query;

    try {
        const result = await Job.findAll({
            where: {
                paymentDate: {
                    [Op.between]: [start, end],
                },
                paid: true,
            },
            include: {
                model: Contract,
                include: { model: Profile, as: 'Contractor' },
            },
            attributes: [
                [sequelize.literal('SUM(price)'), 'total_earnings'],
                [sequelize.col('Contract.Contractor.profession'), 'profession'],
            ],
            group: ['Contract.Contractor.profession'],
            order: [[sequelize.literal('total_earnings'), 'DESC']],
            limit: 1,
        });

        if (result.length === 0) {
            return res.status(404).json({ error: 'No data found for the given time range' });
        }

        const { profession, total_earnings } = result[0].dataValues;
        res.json({ profession, total_earnings });
    } catch (error) {
        console.error('Error fetching best profession: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/admin/best-clients', getProfile, async (req, res) => {
    const { start, end, limit = 2 } = req.query;

    try {
        const result = await Job.findAll({
            where: {
                paymentDate: {
                    [Op.between]: [start, end],
                },
                paid: true,
            },
            include: {
                model: Contract,
                include: { model: Profile, as: 'Client' },
            },
            attributes: [
                [sequelize.literal('SUM(price)'), 'total_paid'],
                [sequelize.col('Contract.Client.id'), 'id'],
                [sequelize.col('Contract.Client.firstName'), 'firstName'],
                [sequelize.col('Contract.Client.lastName'), 'lastName'],
            ],
            group: ['Contract.Client.id'],
            order: [[sequelize.literal('total_paid'), 'DESC']],
            limit: parseInt(limit),
        });

        if (result.length === 0) {
            return res.status(404).json({ error: 'No data found for the given time range' });
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching best clients: ', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


module.exports = app;
