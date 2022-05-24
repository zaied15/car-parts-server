const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Verify JWT Token
function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      res.status(403).send({ message: "Forbidden To Access" });
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

    // Post A part into DB API
    app.post("/parts", verifyJwt, async (req, res) => {
      const parts = req.body;
      const result = await partsCollection.insertOne(parts);
      res.send(result);
    });

    // Get all parts from DB API
    app.get("/parts", async (req, res) => {
      const result = await partsCollection.find().toArray();
      res.send(result);
    });

    // Get a specific parts from DB API
    app.get("/parts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.findOne(query);
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

    // Add Purchase Item to DB API
    app.post("/order", verifyJwt, async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    // Get All Orders
    app.get("/order", verifyJwt, async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    // Get Orders By email
    app.get("/order", verifyJwt, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const query = { email: email };
      const result = await orderCollection.find(query).toArray();
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
      const result = await reviewCollection.find().toArray();
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
