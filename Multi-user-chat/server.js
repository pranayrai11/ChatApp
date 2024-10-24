const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');  // Import User Model
const Chat = require('./models/Chat');  // Import Chat Model

const app = express();
const server = http.createServer(app);

// JWT Secret key (move this to env variables in production)
const JWT_SECRET = 'your_jwt_secret_key';

const io = socketIO(server, {
    cors: {
        origin: 'http://localhost:3001',  // Allow frontend
        methods: ['GET', 'POST'],
    }
});

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3001',  // Allow only this origin (frontend)
    methods: ['GET', 'POST'],  // Specify allowed methods
    credentials: true,  // Allow credentials like cookies and authorization headers
}));

// MongoDB Connection
mongoose.connect('mongodb+srv://pranayrai1234:HGtnPbaNuqznz2xi@chatapp.r1fkt.mongodb.net/?retryWrites=true&w=majority&appName=Chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch((err) => console.log(err));

// Registration API
app.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();
        res.json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Error registering user', error: err.message });
    }
});

// Login API with JWT token
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(400).json({ message: 'User not found' });

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.status(400).json({ message: 'Invalid password' });

        // Generate JWT token
        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: 'Error logging in', error: err.message });
    }
});

// API to fetch all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'username');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching users', error: err.message });
    }
});

// Middleware to authenticate socket connections using JWT
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return next(new Error('Authentication error'));
        }
        socket.user = decoded;  // Store the decoded user data in the socket
        next();
    });
});

// Socket.IO logic for chat
let onlineUsers = {};  // Store users and their socket IDs

io.on('connection', (socket) => {
    const { username } = socket.user;
    console.log(`${username} connected`);

    // Add user to onlineUsers when they join
    socket.on('join', () => {
        onlineUsers[username] = socket.id;
        io.emit('updateUsers', Object.keys(onlineUsers));
    });

    // Handle sending private messages
    socket.on('sendMessage', async ({ receiver, message }) => {
        const sender = username;  // Use username from the socket user
        const newMessage = new Chat({ sender, receiver, message });
        await newMessage.save();  // Save the message to MongoDB

        const receiverSocketId = onlineUsers[receiver];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('newMessage', { 
                sender, 
                message, 
                seen: false, 
                id: newMessage._id  // Send message ID to frontend
            });
        }
        socket.emit('newMessage', { 
            sender, 
            message, 
            seen: false, 
            id: newMessage._id  // Update the sender's chat list with message ID
        });
    });

    // Handle message seen event
    socket.on('messageSeen', async (messageId) => {
        try {
            await Chat.updateOne({ _id: messageId }, { seen: true });
            console.log(`Message with ID ${messageId} marked as seen`);
        } catch (err) {
            console.error('Error marking message as seen:', err);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`${username} disconnected`);
        delete onlineUsers[username];  // Remove the user from onlineUsers
        io.emit('updateUsers', Object.keys(onlineUsers));  // Update the user list
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
