import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css'; // Styling should be managed here

const socket = io('http://localhost:3000'); // Replace with your backend server URL

socket.on('connect', () => {
    console.log('Connected to WebSocket server');
});

socket.on('connect_error', (err) => {
    console.log('Connection failed:', err.message); // Log connection errors
});

const App = () => {
    const [message, setMessage] = useState('');
    const [chat, setChat] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [currentUser, setCurrentUser] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');

    // Load all registered users once the user is logged in
    useEffect(() => {
        if (isLoggedIn) {
            fetchOnlineUsers(); // Fetch online users when logged in
        }
    }, [isLoggedIn]);

    useEffect(() => {
        // Listen for incoming messages and update chat
        socket.on('newMessage', ({ sender, message, seen, id }) => {
            setChat(prev => [...prev, { id, sender, message, seen }]);
        });

        // Update the list of online users
        socket.on('updateUsers', (users) => {
            setOnlineUsers(users);
        });

        return () => {
            // Clean up socket listeners on component unmount
            socket.off('newMessage');
            socket.off('updateUsers');
        };
    }, [chat]);

    const fetchOnlineUsers = async () => {
        try {
            const response = await fetch('http://localhost:3000/users'); // Adjust to your endpoint
            const data = await response.json();
            setOnlineUsers(data); // Update the state with fetched users
        } catch (err) {
            console.error('Error fetching online users:', err);
        }
    };

    const registerUser = async () => {
        if (!username || !password) {
            alert('Please fill out all fields');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3000/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                }),
            });
            
            const data = await response.json();
            if (data.message === 'User registered successfully') {
                alert('Registration successful!');
            } else {
                alert('Registration failed: ' + data.message);
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Error registering user');
        }
    };

    const loginUser = async () => {
        if (!username || !password) {
            alert('Please fill out all fields');
            return;
        }
        
        try {
            const response = await fetch('http://localhost:3000/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username,
                    password,
                }),
            });
            
            const data = await response.json();
            if (data.token) {
                setCurrentUser(username);
                setIsLoggedIn(true);
                socket.emit('join', username); // Emit socket event to join the chat
                fetchOnlineUsers(); // Fetch users after login
            } else {
                alert('Login failed: ' + data.message);
            }
        } catch (err) {
            console.error('Error:', err);
            alert('Error logging in');
        }
    };

    const sendMessage = () => {
        if (!message.trim()) {
            alert('Message cannot be empty');
            return;
        }
        
        if (!selectedUser) {
            alert('Please select a user to chat with!');
            return;
        }

        const newMessage = { sender: currentUser, receiver: selectedUser, message };
        socket.emit('sendMessage', newMessage);
        setChat(prev => [...prev, newMessage]); // Add the sent message to chat
        setMessage(''); // Clear input field
    };

    // Mark message as seen when user opens the chat
    const markMessageAsSeen = (messageId) => {
        socket.emit('messageSeen', messageId);
    };

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <h1>Hinder</h1>
                {isLoggedIn && <p>Logged in as {currentUser}</p>}
            </header>

            {/* Main Body */}
            <main className="app-main">
                {!isLoggedIn ? (
                    <div className="auth-container">
                        <h1 className="title">Sign-up / login</h1>
                        <input 
                            type="text" 
                            placeholder="Enter username" 
                            className="input-field" 
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                        />
                        <input 
                            type="password" 
                            placeholder="Enter password" 
                            className="input-field" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                        />
                        <div className="auth-buttons">
                            <button onClick={registerUser} className="auth-btn">Register</button>
                            <button onClick={loginUser} className="auth-btn">Login</button>
                        </div>
                    </div>
                ) : (
                    <div className="chat-interface">
                        <div className="sidebar">
                            <h2 className="sidebar-title">Online </h2>
                            <ul className="user-list">
                                {onlineUsers.map((user, idx) => (
                                    <li key={idx}>
                                        {user.username !== currentUser && (
                                            <button 
                                                className="user-btn" 
                                                onClick={() => setSelectedUser(user.username)}
                                            >
                                                {user.username}
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="chat-area">
                            {selectedUser ? (
                                <div className="chat-section">
                                    <div className="chat-header">
                                        <h3>Chatting with {selectedUser}</h3>
                                    </div>
                                    <div className="messages">
                                        {chat
                                            .filter(msg => 
                                                (msg.sender === currentUser && msg.receiver === selectedUser) || 
                                                (msg.sender === selectedUser && msg.receiver === currentUser)
                                            ) // Display messages between the current user and the selected user
                                            .map((msg, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`message-bubble ${msg.sender === currentUser ? 'sent' : 'received'}`} // Differentiate sent and received messages
                                                    onClick={() => markMessageAsSeen(msg.id)} // Mark as seen when message is clicked
                                                >
                                                    <p>{msg.message}</p>
                                                </div>
                                            ))}
                                    </div>
                                    <div className="chat-input">
                                        <input
                                            type="text"
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder="Type your message..."
                                            className="input-message"
                                        />
                                        <button onClick={sendMessage} className="send-btn">Send</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-chat">
                                    <h3>Select a user to start chatting</h3>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>&copy; 2024 Chat Application. All rights reserved.</p>
            </footer>
        </div>
    );
};

export default App;