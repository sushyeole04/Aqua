const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3003;

// In production, restrict CORS to your Vercel frontend domain.
// Set the FRONTEND_URL environment variable on your socket hosting platform.
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ['http://localhost:3000', 'http://localhost:3001'];

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Chhatrapati Aqua WebSocket Server is running.\n');
});

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  }
});

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Client joins user-specific room for targeted events
  socket.on('join', (roomName) => {
    socket.join(roomName);
    console.log(`[Socket] Client ${socket.id} joined room: ${roomName}`);
  });

  // Client leaves room
  socket.on('leave', (roomName) => {
    socket.leave(roomName);
    console.log(`[Socket] Client ${socket.id} left room: ${roomName}`);
  });

  // Relay order status changes
  socket.on('order-updated', (data) => {
    // data: { orderId, status, customerId }
    console.log(`[Socket] Order ${data.orderId} updated to: ${data.status}`);
    // Notify the specific customer
    io.to(`customer_${data.customerId}`).emit('order-status-change', data);
    // Notify admins
    io.to('admin_room').emit('admin-notification', {
      title: 'Order Status Transition',
      message: `Order #${data.orderId} updated to ${data.status}.`,
      type: 'ORDER'
    });
  });

  // Relay new order notification to admins
  socket.on('new-order', (data) => {
    // data: { orderId, customerName, quantity }
    console.log(`[Socket] New order placed by: ${data.customerName}`);
    io.to('admin_room').emit('admin-notification', {
      title: 'New Order Received',
      message: `${data.customerName} placed order #${data.orderId} for ${data.quantity} jars.`,
      type: 'ORDER',
      data
    });
  });

  // Relay dues reminder alert to a customer
  socket.on('send-dues-alert', (data) => {
    // data: { customerId, amount, dueDate }
    console.log(`[Socket] Dues alert for customer ${data.customerId}: ₹${data.amount}`);
    io.to(`customer_${data.customerId}`).emit('dues-alert', data);
  });

  // Relay inventory stock alert
  socket.on('low-inventory-alert', (data) => {
    // data: { availableStock }
    console.log(`[Socket] Low stock warning: ${data.availableStock} available`);
    io.to('admin_room').emit('admin-notification', {
      title: 'Inventory Alert',
      message: `Safety stock warning! Only ${data.availableStock} water jars left in inventory.`,
      type: 'INVENTORY'
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`  Chhatrapati Aqua Socket.io Live Server     `);
  console.log(`  Listening on port ${PORT}                 `);
  console.log(`  Allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`=============================================`);
});
