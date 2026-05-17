import jsPDF from 'jspdf'
import 'jspdf-autotable'

function fmtDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-IN')
}

function direction(tx, userId) {
  if (tx.category?.startsWith('BILL_')) return 'Bill Payment'
  if (tx.category === 'WITHDRAWAL') return 'Withdrawal'
  if (tx.senderId === userId) return 'Sent'
  if (tx.receiverId === userId) return 'Received'
  return 'Transaction'
}

export function exportTransactionsCsv(transactions, user) {
  const rows = [
    ['Transaction ID', 'Date', 'Type', 'Category', 'Counterparty', 'Amount', 'Status', 'Description'],
    ...transactions.map(tx => [
      tx.id || '',
      fmtDate(tx.time),
      direction(tx, user?.id),
      tx.category || '',
      tx.senderId === user?.id ? tx.receiverId || '' : tx.senderId || '',
      Number(tx.amount || 0).toFixed(2),
      tx.status || '',
      tx.description || '',
    ]),
  ]

  const csv = rows
    .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `PayFlow_Mini_Statement_${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function exportTransactionsPdf(transactions, user) {
  const doc = new jsPDF()
  doc.setFillColor(14, 165, 233)
  doc.rect(0, 0, 210, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('PayFlow', 14, 22)
  doc.setFontSize(12)
  doc.text('Mini Statement', 150, 22)

  doc.setTextColor(51, 65, 85)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Account: ${user?.name || 'User'} (#${user?.id || ''})`, 14, 46)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 53)

  doc.autoTable({
    startY: 62,
    head: [['Date', 'Type', 'Category', 'Counterparty', 'Amount', 'Status']],
    body: transactions.map(tx => [
      fmtDate(tx.time),
      direction(tx, user?.id),
      tx.category || 'TRANSFER',
      tx.senderId === user?.id ? `#${tx.receiverId || '-'}` : `#${tx.senderId || '-'}`,
      `INR ${Number(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      tx.status || 'SUCCESS',
    ]),
    theme: 'grid',
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 8, cellPadding: 3 },
  })

  doc.save(`PayFlow_Mini_Statement_${new Date().toISOString().slice(0, 10)}.pdf`)
}
