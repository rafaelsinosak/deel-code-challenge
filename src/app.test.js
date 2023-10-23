const request = require('supertest');
const app = require('./app');

const profile_id = 1; //change this variable with the userID

// 1. Contract by ID
describe('1. GET /contracts/:id', () => {
    it('responds with json containing a single contract', async () => {
      const response = await request(app)
        .get('/contracts/1')
        .set('profile_id', profile_id);
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('terms');
    });
  });

// 2. Contracts
describe('2. GET /contracts', () => {
  it('responds with json containing a list of contracts', async () => {
    const response = await request(app)
    .get('/contracts')
    .set('profile_id', profile_id);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
});

// 3. Unpaid Jobs
describe('3. GET /jobs/unpaid', () => {
  it('responds with json containing a list of unpaid jobs', async () => {
    const response = await request(app)
        .get('/jobs/unpaid')
        .set('profile_id', profile_id);
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
});

// 4. Pay for Job
describe('4. POST /jobs/:job_id/pay', () => {
  it('responds with json indicating successful job payment', async () => {
    const response = await request(app)
        .post('/jobs/1/pay')
        .set('profile_id', profile_id);
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Job payment successful');
  });
});

// 5. Deposit Money
describe('5. POST /balances/deposit/:userId', () => {
  it('responds with json indicating successful balance deposit', async () => {
    const response = await request(app).post('/balances/deposit/1').set('profile_id', profile_id).send({ amount: 100 });
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('message', 'Deposit successful');
  });
});

// 6. Best Profession
describe('6. GET /admin/best-profession', () => {
  it('responds with json containing the best profession and total earnings', async () => {
    const response = await request(app).get('/admin/best-profession?start=2023-01-01&end=2023-12-31');
    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty('profession');
    expect(response.body).toHaveProperty('total_earnings');
  });
});

// 7. Best Clients
describe('7. GET /admin/best-clients', () => {
  it('responds with json containing a list of the best clients', async () => {
    const response = await request(app).get('/admin/best-clients?start=2023-01-01&end=2023-12-31&limit=2');
    expect(response.statusCode).toBe(200);
    expect(response.body).toBeInstanceOf(Array);
  });
});
