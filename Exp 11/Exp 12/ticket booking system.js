import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Initialize seats (1-10)
const seats = new Map();
for (let i = 1; i <= 10; i++) {
    seats.set(String(i), { state: 'available' });
}

const LOCK_DURATION_MS = 60 * 1000; // 1 minute

function clearLock(seat) {
    if (seat.lockTimeoutId) {
        clearTimeout(seat.lockTimeoutId);
        seat.lockTimeoutId = undefined;
    }
    delete seat.lockId;
    delete seat.lockedAt;
    seat.state = 'available';
}

// Get all seats with their current status
app.get('/seats', (req, res) => {
    const result = {};
    for (const [id, seat] of seats.entries()) {
        result[id] = {
            state: seat.state,
        };
    }
    res.json(result);
});

// Lock a seat for booking
app.post('/lock/:id', (req, res) => {
    const id = String(req.params.id);
    const seat = seats.get(id);
    
    if (!seat) {
        return res.status(404).json({ message: `Seat ${id} does not exist.` });
    }
    
    if (seat.state === 'booked') {
        return res.status(400).json({ message: `Seat ${id} is already booked.` });
    }
    
    if (seat.state === 'locked') {
        return res.status(400).json({ message: `Seat ${id} is already locked.` });
    }
    
    // Lock the seat
    seat.state = 'locked';
    seat.lockId = uuidv4();
    seat.lockedAt = Date.now();
    
    // Set timeout to auto-unlock
    seat.lockTimeoutId = setTimeout(() => {
        // Only clear if still locked (it may have been booked)
        if (seat.state === 'locked') {
            clearLock(seat);
            console.log(`Auto-unlocked seat ${id} after timeout.`);
        }
    }, LOCK_DURATION_MS);

    return res.status(200).json({
        message: `Seat ${id} locked successfully. Confirm within 1 minute.`,
        lockId: seat.lockId
    });
});

// Confirm booking of a locked seat
app.post('/confirm/:id', (req, res) => {
    const id = String(req.params.id);
    const { lockId } = req.body;
    const seat = seats.get(id);
    
    if (!seat) {
        return res.status(404).json({ message: `Seat ${id} does not exist.` });
    }
    
    if (seat.state !== 'locked') {
        return res.status(400).json({ message: `Seat ${id} is not locked.` });
    }
    
    if (seat.lockId !== lockId) {
        return res.status(400).json({ message: `Invalid lock ID for seat ${id}.` });
    }
    
    // Confirm booking
    clearTimeout(seat.lockTimeoutId);
    delete seat.lockTimeoutId;
    delete seat.lockId;
    delete seat.lockedAt;
    seat.state = 'booked';
    
    return res.status(200).json({
        message: `Seat ${id} booked successfully.`
    });
});

// Unlock a seat (cancel lock)
app.post('/unlock/:id', (req, res) => {
    const id = String(req.params.id);
    const { lockId } = req.body;
    const seat = seats.get(id);
    
    if (!seat) {
        return res.status(404).json({ message: `Seat ${id} does not exist.` });
    }
    
    if (seat.state !== 'locked') {
        return res.status(400).json({ message: `Seat ${id} is not locked.` });
    }
    
    if (seat.lockId !== lockId) {
        return res.status(400).json({ message: `Invalid lock ID for seat ${id}.` });
    }
    
    // Unlock the seat
    clearLock(seat);
    
    return res.status(200).json({
        message: `Seat ${id} unlocked successfully.`
    });
});

// Reset all seats (for testing purposes)
app.post('/reset', (req, res) => {
    for (const [id, seat] of seats.entries()) {
        if (seat.lockTimeoutId) {
            clearTimeout(seat.lockTimeoutId);
        }
        seats.set(id, { state: 'available' });
    }
    
    return res.status(200).json({
        message: 'All seats reset to available.'
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Ticket booking server running on port ${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  GET /seats - View all seats`);
    console.log(`  POST /lock/:id - Lock a seat`);
    console.log(`  POST /confirm/:id - Confirm booking`);
    console.log(`  POST /unlock/:id - Cancel lock`);
    console.log(`  POST /reset - Reset all seats`);
});
