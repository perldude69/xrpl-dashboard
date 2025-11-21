(function() {
  window.XRPL = window.XRPL || {};

  const tableBody = document.querySelector('#transactions tbody');
  const rlusdBody = document.querySelector('#rlusd tbody');

  // Event handlers for transactions
  window.XRPL.socket.on('newTransaction', (data) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.sender}</td>
      <td>${data.receiver}</td>
      <td>${data.amount} XRP</td>
      <td>${new Date(data.timestamp).toLocaleString()}</td>
    `;
    tableBody.appendChild(row);
    if (tableBody.children.length > 10) tableBody.removeChild(tableBody.firstChild);
  });

  window.XRPL.socket.on('newRLUSDTransaction', (data) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${data.sender}</td>
      <td>${data.receiver}</td>
      <td>${data.amount} RLUSD</td>
      <td>${new Date(data.timestamp).toLocaleString()}</td>
    `;
    rlusdBody.appendChild(row);
    if (rlusdBody.children.length > 10) rlusdBody.removeChild(rlusdBody.firstChild);
  });
})();