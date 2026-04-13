const API = 'http://localhost:8080';

async function test() {
  try {
    const ts = Date.now();
    const email = `alice_${ts}@example.com`;

    await fetch(API + '/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', email: email, password: 'pass', phoneNumber: `555${ts.toString().slice(-7)}` })
    });

    const loginRes = await fetch(API + '/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: 'pass' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;
    const userId = loginData.user.id;

    console.log('Sending split payment request...');
    const bodyStr = JSON.stringify({
      creatorId: userId,
      title: 'dinner',
      totalAmount: 5000,
      participantIds: [2] // let's use a single valid ID just in case
    });
    
    const res = await fetch(API + '/split/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: bodyStr
    });
    
    console.log('SERVER RETURNED:', res.status, res.statusText);
    const text = await res.text();
    console.log('RESPONSE TEXT:', text);
  } catch (err) {
    console.log('NETWORK ERROR:', err);
  }
}
test();
