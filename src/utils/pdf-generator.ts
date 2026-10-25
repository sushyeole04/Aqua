export interface InvoiceData {
  invoiceNum: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerQrId: string;
  date: string;
  dueDate: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  cgst: number; // 9%
  sgst: number; // 9%
  total: number;
  paymentMethod: string;
  paymentStatus: string;
}

export function generateInvoiceHTML(data: InvoiceData): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Invoice - ${data.invoiceNum}</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          color: #333;
          margin: 0;
          padding: 40px;
          line-height: 1.6;
        }
        .invoice-card {
          max-width: 800px;
          margin: 0 auto;
          border: 1px solid #e2e8f0;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo-section h1 {
          color: #1d4ed8;
          margin: 0 0 5px 0;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .logo-section p {
          margin: 0;
          color: #64748b;
          font-size: 14px;
        }
        .invoice-details {
          text-align: right;
        }
        .invoice-details h2 {
          margin: 0 0 10px 0;
          color: #1e293b;
          font-size: 24px;
        }
        .invoice-details p {
          margin: 2px 0;
          color: #64748b;
          font-size: 14px;
        }
        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 45px;
        }
        .section-title {
          font-size: 12px;
          text-transform: uppercase;
          color: #94a3b8;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .address-box p {
          margin: 3px 0;
          font-size: 14px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        .table th {
          background-color: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
          color: #475569;
          font-weight: 600;
          text-align: left;
          padding: 12px 16px;
          font-size: 14px;
        }
        .table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 16px;
          font-size: 14px;
          color: #334155;
        }
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 40px;
        }
        .totals-box {
          width: 300px;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          font-size: 14px;
          color: #475569;
        }
        .totals-row.grand-total {
          border-top: 2px solid #e2e8f0;
          font-weight: 700;
          font-size: 18px;
          color: #1e293b;
          padding-top: 12px;
        }
        .footer {
          text-align: center;
          margin-top: 50px;
          border-top: 1px solid #e2e8f0;
          padding-top: 20px;
          font-size: 12px;
          color: #94a3b8;
        }
        .stamp {
          border: 3px dashed #10b981;
          color: #10b981;
          display: inline-block;
          padding: 6px 12px;
          font-weight: 800;
          text-transform: uppercase;
          transform: rotate(-5deg);
          border-radius: 4px;
          font-size: 14px;
          margin-top: 10px;
        }
        .stamp.unpaid {
          border-color: #ef4444;
          color: #ef4444;
        }
        @media print {
          body {
            padding: 0;
          }
          .invoice-card {
            border: none;
            box-shadow: none;
            padding: 0;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="invoice-card">
        <div class="header">
          <div class="logo-section">
            <h1>CHHATRAPATI AQUA</h1>
            <p>Enterprise Water Delivery & SaaS Solutions</p>
            <p style="margin-top: 5px; font-weight: 600;">GSTIN: 27AASFC4120A1ZX</p>
          </div>
          <div class="invoice-details">
            <h2>TAX INVOICE</h2>
            <p><strong>Invoice No:</strong> ${data.invoiceNum}</p>
            <p><strong>Date:</strong> ${data.date}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
          </div>
        </div>

        <div class="details-grid">
          <div class="address-box">
            <div class="section-title">Billed From</div>
            <p><strong>Chhatrapati Aqua Suppliers Ltd.</strong></p>
            <p>Pipeline Road, Behind Shivaji Garden</p>
            <p>Pune, Maharashtra - 411002</p>
            <p>Email: billing@chhatrapatiaqua.com</p>
          </div>
          <div class="address-box">
            <div class="section-title">Billed To</div>
            <p><strong>${data.customerName}</strong></p>
            <p>Phone: ${data.customerPhone}</p>
            <p>Address: ${data.customerAddress}</p>
            <p>Customer ID: ${data.customerQrId}</p>
          </div>
        </div>

        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Qty</th>
              <th style="text-align: right;">Unit Price (₹)</th>
              <th style="text-align: right;">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>20L Purified Water Jar (High Quality Filtration)</td>
              <td style="text-align: right;">${data.quantity}</td>
              <td style="text-align: right;">${data.unitPrice.toFixed(2)}</td>
              <td style="text-align: right;">${(data.quantity * data.unitPrice).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-section">
          <div class="totals-box">
            <div class="totals-row">
              <span>Subtotal:</span>
              <span>₹${data.subtotal.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>CGST (9%):</span>
              <span>₹${data.cgst.toFixed(2)}</span>
            </div>
            <div class="totals-row">
              <span>SGST (9%):</span>
              <span>₹${data.sgst.toFixed(2)}</span>
            </div>
            <div class="totals-row grand-total">
              <span>Total Payable:</span>
              <span>₹${data.total.toFixed(2)}</span>
            </div>
            <div style="text-align: right; margin-top: 15px;">
              <span class="stamp ${data.paymentStatus === 'PAID' ? 'paid' : 'unpaid'}">
                ${data.paymentStatus === 'PAID' ? 'PAID' : 'PAYMENT PENDING'}
              </span>
            </div>
          </div>
        </div>

        <div style="margin-top: 20px; font-size: 13px; color: #64748b; border-top: 1px dashed #cbd5e1; padding-top: 20px;">
          <p><strong>Payment Info:</strong> Method: ${data.paymentMethod} | Status: ${data.paymentStatus}</p>
          <p><strong>Terms:</strong> Please return empty jars upon next delivery. Pending dues should be settled before the 5th of every month. For any queries, contact Pune Operations Office.</p>
        </div>

        <div class="footer">
          <p>Thank you for choosing Chhatrapati Aqua! Hydrating your life every day.</p>
          <p>© 2026 Chhatrapati Aqua SaaS. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function downloadInvoicePDF(data: InvoiceData): void {
  const htmlContent = generateInvoiceHTML(data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    // Allow resource loading then print
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
}
