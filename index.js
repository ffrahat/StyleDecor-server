const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const app = express();
// Load .env variables at the very top
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;
const stripe = require('stripe')(`${process.env.STRIPE_SECRET}`);


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
    
      // await client.connect();
      // await client.db("admin").command({ ping: 1 });
      // console.log("Pinged your deployment. You successfully connected to MongoDB!");
        

      // Crud Operations
      const db = client.db('style_decor_db');
      const usersCollection = db.collection('users');
    const servicesCollection = db.collection('services');
    const bookingsCollection = db.collection('bookings');
    const paymentsCollection = db.collection('payments');
    const decoratorsCollection = db.collection('decorators');


      //   Users Related APis
      
      app.get('/users', async (req, res) => {
        try {
          const { searchText, sort } = req.query;
          const query = {};
          if (searchText) {
            // query.$or = [
            //   {displayName : {$regex : searchText, $options: 'i'}}
            // ]

            // query.$or = [
            //   { displayName: { $regex: searchText, $options: "i" } },
            //   { email: { $regex: searchText, $options: "i" } },
            // ];

            query.$or = [
              { name: { $regex: searchText, $options: 'i' } },
              { email: { $regex: searchText, $options: 'i' } }
            ]

          }

          if (sort) {
            query.role = sort;
          }


            const cursor = usersCollection.find(query);
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

      // Sort
      const { sort = 'cost', order, searchText } = req.query; 
      console.log(searchText)
      const sortOption = {};

      sortOption[sort || 'cost'] = order === 'asc' ? 1 : -1;

// Search
      const query = {};

      if(searchText){
        query.$or = [
          { service_name: { $regex: searchText, $options: 'i' } },
          { service_category: {$regex: searchText, $options: 'i' }}
        ]
      }
      
      const cursor = servicesCollection.find(query).sort(sortOption);
      const result = await cursor.toArray();
      res.send(result)
    })

    
    app.get('/services/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const result = await servicesCollection.findOne(query);
        res.status(200).send(result)
      } catch (error) {
        console.log(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    })


    // Add Services Adimin

    app.post('/services', async (req, res) => {
      const newServiceInfo = req.body;
      const result = await servicesCollection.insertOne(newServiceInfo);
      res.send(result)
    })




    // Bookings related apis

    app.get('/my-bookings', async (req, res) => {
      try {
        const { email } = req.query;
        const query = {};
      if (email) {
        query.client_email = email;
      }
        const result = await bookingsCollection.find(query).sort({created_At: -1}).toArray();
        res.status(200).send(result);
      } catch (error) {
        console.log(error);
        res.status(500).send({message: "Internal Server Error"})
      }
    })

    // cancel booking
    app.patch('/cancel-booking', async (req, res) => {
      const cancelId = req.query.cancel_id;
      if (cancelId) {
        const cancelQuery = {_id: new ObjectId(cancelId)}
        const cancelInfo = {
          $set: {
            service_status: "cancelled"
          }
        }
        const cancelBooking = await bookingsCollection.updateOne(cancelQuery, cancelInfo);
        res.send(cancelBooking)
      }
    })




    app.post('/bookings', async (req, res) => {
      try {
        const bookingInfo = req.body;
        bookingInfo.created_At = new Date();
        const result = await bookingsCollection.insertOne(bookingInfo);
        res.send(result);
      } catch (error) {
        console.log(error)
        res.status(500).send({message: "Internal Server Error"})
      }

    })


    // Stripe payment related apis
    app.post('/create-checkout-session', async (req, res) => {
      const { email, serviceId, booking_id, booking_quantity } = req.body;
     
      const query = { _id: new ObjectId(serviceId) }
      const booked_services_info = await servicesCollection.findOne(query);
      const booking_cost = booked_services_info.cost;
    

      // Convert BDT → USD cents
      const usdCents = Math.round(booking_cost / 127.1409 * 100);

      const finalAmount = Math.max(usdCents, 50);
    

     console.log('in booked', booking_cost, usdCents, finalAmount)

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            // Provide the exact Price ID (for example, price_1234) of the product you want to sell
            price_data: {
              currency: "usd",
              product_data: {
                name: booked_services_info?.service_name || 'Unnamed Service',
                images: [
                  booked_services_info?.images[0]?.url ||
                  'https://example.com/default-image.png'
                ],
              },
              unit_amount: finalAmount
            },
            quantity: 1,
          },
        ],

        metadata: {
          booking_id: booking_id,
          serviceId: serviceId,
          serviceName: booked_services_info?.service_name
        },
        customer_email: email,
        mode: 'payment',
        success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancel`,
      })

      res.send({url: session.url})
      
    });
      


    // Validate payment
    app.patch('/payment-success', async (req, res) => {
      const session = await stripe.checkout.sessions.retrieve(
        req.query.session_id
      );

      if (session.payment_status === 'paid') {
        const serviceId = session.metadata.serviceId;
        const client_email = session.customer_email;
        const booking_id = session.metadata.booking_id;
        const transitionId = session.payment_intent;
        const payment_status = session.payment_status;

        // Update booking info
        const bookingQuery = { _id: new ObjectId(booking_id) };
        const bookingInfo = {
        $set: {
          payment_status: "paid",
          service_status: "service_on_the_way"
          }
        }
        const result = await bookingsCollection.updateOne(bookingQuery, bookingInfo);
        const bookingDetails = await bookingsCollection.findOne(bookingQuery);
        console.log('booking details bm rahat', bookingDetails)
        

        // Insert Payment info

        const paymentInfo = {
          serviceId,
          booking_id,
          booking_cost: bookingDetails.booking_cost,
          payment_status,
          client_email,
          transitionId,
          paidAt: new Date()
        }

        
        // Payment Exist
        const existQuery = { transitionId };

        const paymentExist = await paymentsCollection.findOne(existQuery);

        if (paymentExist) {
          return res.send({messsage: 'Payment already done!', transitionId})
        }

        const paymentResult = await paymentsCollection.insertOne(paymentInfo);
        console.log(session)
        res.send({ result, transitionId, paymentResult })
      }

     
      
    })


    // Decorators related apis
    app.post('/decorators', async (req, res) => {
      const decoratorsInfo = req.body;
      decoratorsInfo.application_At = new Date();
      decoratorsInfo.application_status = 'pending';
      const result = await decoratorsCollection.insertOne(decoratorsInfo);
      res.send(result)
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