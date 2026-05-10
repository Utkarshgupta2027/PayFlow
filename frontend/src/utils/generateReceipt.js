import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateReceipt(transaction, currentUser) {
  const doc = new jsPDF();
  
  // Header: Logo / Title
  doc.setFillColor(14, 165, 233); // PayFlow Accent color (#0ea5e9)
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("PayFlow", 14, 25);
  
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Transaction Receipt", 140, 25);

  // Determine Sender & Receiver Labels
  const isSent = transaction.senderId === currentUser.id;
  
  // Content styling
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  
  const dateStr = transaction.time ? new Date(transaction.time).toLocaleString('en-IN') : 'N/A';
  
  doc.text(`Receipt generated on: ${new Date().toLocaleString('en-IN')}`, 14, 50);
  doc.text(`Transaction ID: ${transaction.id || 'N/A'}`, 14, 60);
  doc.text(`Date & Time: ${dateStr}`, 14, 65);
  doc.text(`Status: ${transaction.status || 'SUCCESS'}`, 14, 70);

  // Amount Block
  doc.setFillColor(245, 247, 250);
  doc.rect(14, 80, 182, 30, 'F');
  
  doc.setFontSize(14);
  doc.setTextColor(100, 116, 139);
  doc.text("Total Amount", 20, 95);
  
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  const amountColor = isSent ? [248, 113, 113] : [52, 211, 153]; // Red if sent, Green if received
  doc.setTextColor(amountColor[0], amountColor[1], amountColor[2]);
  doc.text(`INR ${Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 140, 95);
  
  // Details Table
  doc.autoTable({
    startY: 120,
    head: [['Detail', 'Information']],
    body: [
      ['Sender Account ID', `#${transaction.senderId}`],
      ['Receiver Account ID', `#${transaction.receiverId}`],
      ['Transaction Category', transaction.category || 'TRANSFER'],
      ['Description', transaction.description || 'N/A'],
      ['Risk Level', transaction.riskLevel || 'LOW'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [14, 165, 233] },
    styles: { fontSize: 10, cellPadding: 5 }
  });

  // Footer
  const finalY = doc.lastAutoTable.finalY + 30;
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text("Thank you for using PayFlow.", 14, finalY);
  doc.text("If you have any questions regarding this receipt, please contact support.", 14, finalY + 5);

  // Save the PDF
  doc.save(`PayFlow_Receipt_Tx_${transaction.id || 'unknown'}.pdf`);
}
