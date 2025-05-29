const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000;



app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://mini-productivity-client-463j.vercel.app',

  ],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser())

// Token Verify
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token

  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' })
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err)
      return res.status(401).send({ message: 'unauthorized access' })
    }
    req.user = decoded
    next()
  })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.emc8p.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // start Collection-------->

    const usersCollection = client.db('miniProductivity').collection('users')
    const tasksCollection = client.db('miniProductivity').collection('tasks');
    const goalsCollection = client.db('miniProductivity').collection('goals');


    // Save or update a user in db ----->
    app.post('/users', async (req, res) => {
      const { email, name, photoURL } = req.body;
      const existing = await usersCollection.findOne({ email });
      if (existing) return res.send(existing);

      const newUser = {
        name,
        email,
        photoURL,
        role: 'user',
        createdAt: new Date()
      };

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Login: issue token ------>
    app.post('/jwt', async (req, res) => {
      const { email } = req.body;
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d'
      });


      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true });
    });

    // Logout get ----->
    app.get('/logout', (req, res) => {
      res.clearCookie('token', {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      }).send({ success: true });
    });

    // Add Task (Create)
    app.post('/tasks', verifyToken, async (req, res) => {
      const task = req.body;
      task.userEmail = req.user.email;
      task.status = 'incomplete';       // Default status
      task.createdAt = new Date();

      const result = await tasksCollection.insertOne(task);
      res.send(result);
    });

    // Get Tasks for logged-in user
    app.get('/tasks', verifyToken, async (req, res) => {
      const email = req.user.email;
      const tasks = await tasksCollection.find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
      res.send(tasks);
    });

    // Update task status to 'completed'
    app.patch('/tasks/:id/complete', verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.user.email;

      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id), userEmail: email },
        { $set: { status: 'completed' } }
      );
      res.send(result);
    });

    // Delete task 
    app.delete('/delete/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await tasksCollection.deleteOne(query);
      res.send(result)
    })

    // Get single task by ID
    app.get('/tasks/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.user.email;

      const task = await tasksCollection.findOne({
        _id: new ObjectId(id),
        userEmail: email,
      });
      res.send(task);
    });

    // Update a task by ID
    app.put('/tasks/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedTask = req.body;
      const email = req.user.email;

      const result = await tasksCollection.updateOne(
        { _id: new ObjectId(id), userEmail: email },
        { $set: updatedTask }
      );

      res.send(result);
    });

    // Add Goal------------>
    app.post('/goals', verifyToken, async (req, res) => {
      const { goal, type } = req.body;
      const email = req.user.email;

      const newGoal = {
        goal,
        type,
        userEmail: email,
        createdAt: new Date()
      };

      const result = await goalsCollection.insertOne(newGoal);
      res.send(result);
    });

    // Get all goals for the logged-in user
    app.get('/goals', verifyToken, async (req, res) => {
      const email = req.user.email;
      const goals = await goalsCollection.find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
      res.send(goals);
    });

    // Get Single Goal by ID
    app.get('/goals/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.user.email;

      const goal = await goalsCollection.findOne({
        _id: new ObjectId(id),
        userEmail: email
      });

      res.send(goal);
    });

    // Update Goal by ID
    app.put('/goals/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const updatedGoal = req.body;
      const email = req.user.email;

      const result = await goalsCollection.updateOne(
        { _id: new ObjectId(id), userEmail: email },
        { $set: updatedGoal }
      );

      res.send(result);
    });

    // Delete Goal by ID
    app.delete('/goals/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const email = req.user.email;

      const result = await goalsCollection.deleteOne({
        _id: new ObjectId(id),
        userEmail: email
      });

      res.send(result);
    });


    //  New Route for Motivational Quote
    app.get('/quote', async (req, res) => {
      try {
        const response = await fetch('https://zenquotes.io/api/random');
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const { q, a } = data[0];
          res.send({ quote: q, author: a || 'Unknown' });
        } else {
          res.status(404).send({ message: 'No quote found' });
        }
      } catch (error) {
        console.error('Quote fetch error:', error);
        res.status(500).send({ message: 'Failed to fetch quote' });
      }
    });

    // optional---->
    app.get('/users/info', verifyToken, async (req, res) => {
      const email = req.query.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);
    });







    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('mini productivity platform started')
})
app.listen(port, () => {
  console.log(`mini productivity platform:${port}`)
})

