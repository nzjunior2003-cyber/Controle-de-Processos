fetch('https://docs.google.com/spreadsheets/d/1Ja9mQVJ4KWkFtjNBjuoSONnKoj2GIT7ltUYAByLetrg/export?format=csv').then(res => {
  if (res.redirected) console.log('Redirected to:', res.url);
  return res.text();
}).then(data => console.log('Data (first 500 chars):', data.substring(0, 500))).catch(err => console.error(err));
