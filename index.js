const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
// Load .env variables at the very top
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;


// MiddleWare
app.use(express.json());
app.use(cors());

// Verify FIrebase Token





// Firebase
const admin = require("firebase-admin");

// Firebase service account
const serviceAccount = require("./styledecor-2025-firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// MongoDb 
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simplecrud.h04rjld.mongodb.net/?appName=SimpleCrud`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// Main and Connect

async function run() {
  try {
    
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
      

      // Crud Operations
      const db = client.db('style_decor_db');
      const usersCollection = db.collection('users');
      const servicesCollection = db.collection('services');


      //   Users Related APis
      
      app.get('/users', async (req, res) => {
          try {
            const cursor = usersCollection.find();
            const result = await cursor.toArray();
            res.status(200).send(result)
          }catch (error) {
            console.log(error);
            res.status(500).send({ message: 'Internal Server Error' });
          }
      })

      app.post('/users', async (req, res) => {
          try {
              const userInfo = req.body;
            const email = userInfo.email;
            const query = {email}
            const userExist = await usersCollection.findOne(query);
          if (userExist) {
              return res.send({ message: 'user already exist!'})
          }

            userInfo.role = 'user',
            userInfo.created_At = new Date();
            const result = await usersCollection.insertOne(userInfo);
            res.send(result)
          } catch (error) {
            console.log(error);
            res.status(500).send({ message: 'Internal Server Error' });
          }
      })
    
    
    
    // Services Related Apis
    app.get('/services', async (req, res) => {
      const result = await servicesCollection.find().toArray();
      res.send(result)
    })

    
    app.get('/services/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const cursor = servicesCollection.find(query);
        const result = await cursor.toArray();
        res.status(200).send(result)
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    })
      


























      
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("Your StyleDecor Server is running");
})

app.listen(port, () => {
    console.log(`Your server is running port: ${port}`)
})