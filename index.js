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


// Verify Firebase Token
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authToken = req.headers.authorization;
    if (!authToken) {
      return res.status(401).send({ message: 'No token provided' });
    }

    const token = authToken.split(' ')[1];
    if (!token) {
      return res.status(401).send({ message: 'Invalid token format' });
    }

    // Firebase Admin  token verify
    const decodedUser = await admin.auth().verifyIdToken(token);
    console.log(decodedUser)
    req.user = decodedUser; 

    next(); 

  } catch (error) {
    return res.status(401).send({ message: 'Unauthorized: Invalid token' });
  }
};





// Firebase
const admin = require("firebase-admin");

const decoded = process.env.FIREBASE_SERVICE_KEY;
const serviceAccount = JSON.parse(Buffer.from(decoded, "base64").toString("utf8"));

// Firebase service account
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
    const bookingsCollection = db.collection('bookings');
    const paymentsCollection = db.collection('payments');
    const decoratorsCollection = db.collection('decorators');
    const coveragesCollection = db.collection('coverage');


      //   Users Related APis
      
      app.get('/users',verifyFirebaseToken, async (req, res) => {
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
    
    
    // User role 
    app.get("/users/:email/role", verifyFirebaseToken,  async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });


    // coverage 
    app.get('/coverages', async (req, res) => {
      const result = await coveragesCollection.find().toArray();
      res.send(result)
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
    
    
    
    // Update role
    
    app.patch('/users/role', verifyFirebaseToken, async (req, res) => {
      const { id, role } = req.query;
      console.log(id, role)
      const query = { _id: new ObjectId(id) };
      const updateRole = {
        $set: {
          role: role
        }
      }

      const result = await usersCollection.updateOne(query, updateRole);
      res.send(result)

    })




    


  // Decorators related apis
    app.get('/decorators',  async (req, res) => {
      
      const { work_status, application_status, district } = req.query;
      const query = {}

      console.log('dis' , district)

      if (district) {
        query.district = district;
        query.work_status = work_status;
        query.application_status = application_status;
      }

      console.log(query)

      const result = await decoratorsCollection.find(query).sort({application_At: -1}).toArray();
      res.send(result)
    })


    // top 
    app.get('/top-decorators', async (req, res) => {
      const result = await decoratorsCollection.find().sort({application_At: -1}).limit(3).toArray();
      res.send(result)
    })



    // Assign Decorators
    app.patch('/assign-decorator', async (req, res) => {
      const { booking_id } = req.query;
      const decoratorInfo = req.body;

      // Update booking info
      const bookingQuery = { _id: new ObjectId(booking_id) }
      const bookingInfo = {
        $set: {
          service_status: 'assigned',
          decorator_email: decoratorInfo.email,
          decorator_name: decoratorInfo.name
        }
      }
      const bookingResult = await bookingsCollection.updateOne(bookingQuery, bookingInfo);

      // Update Decorator

      const decoratorQuery = { _id: new ObjectId(decoratorInfo._id) };
      const decInfo = {
        $set: {
           work_status: 'on_delivery'
        }
      }

      const decoratroResult = await decoratorsCollection.updateOne(decoratorQuery, decInfo)
      res.send(decoratroResult)

    })


    // My Asssign Project 
    app.get('/my-assigned-projects', async (req, res) => {
      const { email } = req.query;
      
      const query = {decorator_email: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    })


    // update service status by decorators
    app.patch('/update-service-status', async (req, res) => {
      const { id } = req.query;
      const serviceStatus = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          service_status: serviceStatus.service_status
        }
      }

      const result = await bookingsCollection.updateOne(query, updatedDoc);
      res.send(result);

    } )



    // application decorators
    app.post('/decorators', verifyFirebaseToken, async (req, res) => {
      const decoratorsInfo = req.body;
      const query = { email: decoratorsInfo.email }
      
      const existApply = await decoratorsCollection.findOne(query);
      if (existApply) {
        return res.send({message: "Already Applied!"})
      }

      decoratorsInfo.application_At = new Date();
      decoratorsInfo.application_status = 'pending';
      const result = await decoratorsCollection.insertOne(decoratorsInfo);
      res.send(result)
    })


        
    // Update role
    
    app.patch('/decorators/role',verifyFirebaseToken, async (req, res) => {
      const { email, role, application_status } = req.query;
      const query = { email: email };

      if (application_status === 'reject') {
        // update application status reject
      const updateApplicationStatus = {
        $set: {
          application_status: application_status
        }
        }
    
      

      const decorators = await decoratorsCollection.updateOne(query, updateApplicationStatus);

      return res.send(decorators)

      }


      console.log(email, role, application_status)
     
      
      
      // update user role
      const updateRole = {
        $set: {
          role: role
        }
      }

      const result = await usersCollection.updateOne(query, updateRole);

      // update application status
      const updateApplicationStatus = {
        $set: {
          application_status: application_status,
          work_status: 'available'
        }
      }

      const decorators = await decoratorsCollection.updateOne(query, updateApplicationStatus);

      res.send(decorators)

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

    app.post('/services', verifyFirebaseToken, async (req, res) => {
      const newServiceInfo = req.body;
      const result = await servicesCollection.insertOne(newServiceInfo);
      res.send(result)
    })


    // edit service 
    app.patch('/services/:id/edit', verifyFirebaseToken, async (req, res) => {
      const info = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateInfo = {
        $set: {
          service_name: info.service_name,
          service_category: info.service_category,
          cost: info.cost,  
          description: info.description,
          imageUrl: info.imageUrl,
          images: info.images,
          unit: info.unit,
          createdByEmail: info.createdByEmail,
          currency: info.currency
        }
      }
 

      const result = await servicesCollection.updateOne(query, updateInfo);
      res.send(result)
       
    })

    // delete service
    app.delete('/services/:id/delete',verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await servicesCollection.deleteOne(query);
      res.send(result);
    })




    // Bookings related apis



    app.get('/bookings',verifyFirebaseToken, async (req, res) => {
      
      const { sort } = req.query;
      console.log(sort)

      const sortBy = sort.split('=')[0];
      const sortOrder = sort.split('=')[1]
      
      const query = {};
      if (sort) {
        query[sortBy] = sortOrder;


        // if paid not showing cancelled
        if (sortBy === 'payment_status' && sortOrder === 'paid') {
          query.service_status = 'service_on_the_way';
        }
      }

      console.log(query)

      
      const result = await bookingsCollection.find(query).sort({created_At: -1}).toArray(); //admin
      res.send(result);
    }) 
//decoded need
    app.get('/my-bookings', verifyFirebaseToken, async (req, res) => {
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
    app.patch('/cancel-booking',verifyFirebaseToken, async (req, res) => {
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

    // delete my bookings

    app.delete('/my-bookings/:id/delete',verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    })




    app.post('/bookings',verifyFirebaseToken, async (req, res) => {
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
        cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancel`,
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
          service_status: "wait_for_assign"
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