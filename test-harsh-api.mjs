import http from 'http';
http.get('http://localhost:3000/api/profile/discover?limit=50', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const harsh = json.profiles.find(p => p.name.includes('Harsh'));
    console.log(JSON.stringify(harsh, null, 2));
  });
}).on('error', (err) => console.log('Error: ', err.message));
