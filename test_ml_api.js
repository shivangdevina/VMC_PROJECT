const fetch = require('node-fetch');

async function testMLAPI() {
  try {
    console.log('Testing ML API health...');
    const healthResponse = await fetch('http://192.168.1.7:8000/health');
    const healthData = await healthResponse.json();
    console.log('ML API Health:', healthData);

    console.log('\nTesting ML API info...');
    const infoResponse = await fetch('http://192.168.1.7:8000/info');
    const infoData = await infoResponse.json();
    console.log('ML API Info:', infoData);

  } catch (error) {
    console.error('Error testing ML API:', error);
  }
}

testMLAPI();
