const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
// const corsConfig = {
//   origin: "*",
//   credentials: true,
//   methods: ["Get", "POST", "PUT", "DELETE"],
// };
// app.use(cors(corsConfig));
// app.options("*", cors(corsConfig));
// app.use(express.json());
// app.use(function (req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header(
//     "Access-Control-Allow-Headers",
//     "Origin, X-Requested-With,Content-Type,Accept,authorization"
//   );
//   next();
// });

// Verify JWT Token
function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden To Access" });
    }
    req.decoded = decoded;
    next();
  });
}

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_ADMIN}:${process.env.DB_PASS}@cluster0.nka8o.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();

    // Database Collection
    const partsCollection = client.db("pitsTop").collection("parts");
    const userCollection = client.db("pitsTop").collection("users");
    const reviewCollection = client.db("pitsTop").collection("reviews");
    const profileCollection = client.db("pitsTop").collection("profiles");
    const orderCollection = client.db("pitsTop").collection("order");
    const paymentCollection = client.db("pitsTop").collection("payment");

    // Post A part into DB API
    app.post("/parts", verifyJwt, async (req, res) => {
      const parts = req.body;
      const result = await partsCollection.insertOne(parts);
      res.send(result);
    });

    // Get all parts from DB API
    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });

    // Get a specific parts from DB API
    app.get("/parts/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
      res.send(result);
    });

    // Delete a specific product from DB API
    app.delete("/parts/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.deleteOne(query);
      res.send(result);
    });

    // User set on login and registration authentication API
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, token: token });
    });

    // All User Get API
    app.get("/users", verifyJwt, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Set user Role API
    app.patch("/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // Admin Role Check API
    app.get("/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      const query = { email: email };
      if (email === decodedEmail) {
        const user = await userCollection.findOne(query);
        const isAdmin = user.role === "admin";
        res.send({ admin: isAdmin });
      }
    });

    // Add Purchase Item to DB API
    app.post("/order", verifyJwt, async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    // Get All Orders
    app.get("/orders", verifyJwt, async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    // Get Orders By email
    app.get("/order", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // Get Order by Id
    app.get("/order/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.findOne(query);
      res.send(result);
    });

    // Delete Order By Admin API
    app.delete("/adminOrderDelete/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // Payment API
    app.post("/create-payment-intent", verifyJwt, async (req, res) => {
      const price = req.body.price;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // Store paid order in new collection and update order
    app.patch("/paidOrder/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const payment = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const result = await paymentCollection.insertOne(payment);
      const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedDoc);
    });

    // Shipping Status update on order collection and payment collection
    app.patch("/shippingStatus/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          shipping_status: true,
        },
      };
      const updatedShippingStatus = await orderCollection.updateOne(
        filter,
        updatedDoc
      );
      res.send(updatedShippingStatus);
    });

    // Delete My Order API
    app.delete("/myOrder/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });

    // Add A Review Post API
    app.post("/review", verifyJwt, async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // All Reviews Get API
    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().sort({ _id: -1 }).toArray();
      res.send(result);
    });

    // Profile update API
    app.put("/profile/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
      const profile = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: profile,
      };
      if (email === decodedEmail) {
        const result = await profileCollection.updateOne(
          filter,
          updateDoc,
          options
        );
        res.send(result);
      }
    });
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello PitsTop!");
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
