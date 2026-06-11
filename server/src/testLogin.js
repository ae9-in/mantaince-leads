import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://127.0.0.1:5000/api/v1/auth/login', {
      email: 'admin@gmail.com',
      password: 'admin123'
    });
    console.log('Success:', res.status, res.data);
  } catch (err) {
    console.log('Error Message:', err.message);
    if (err.response) {
      console.log('Response Status:', err.response.status);
      console.log('Response Data:', err.response.data);
    } else {
      console.log('No response received:', err);
    }
  }
}
test();
