//rememeber to run only when in the file .../GITI/Method3_MongoDBmethod
const { MongoClient, ServerApiVersion } = require('mongodb');

require('dotenv').config({path: "./GITI/Method3_MongoDBmethod/.env"});
const uri = process.env.MONGODB_URI;
const wsIPport = "ws://192.168.1.6:81"; //change IP and port

let client;
let db;

function toIST(date) {
    // Convert UTC date to IST (UTC+5:30)
    const istOffset = 5 * 60 + 30; // IST is UTC+5:30
    return new Date(new Date(date).getTime() + istOffset * 60 * 1000);
}

async function connectToMongoDB() {
    console.log("Connecting...");
    if (!client) {
        client = new MongoClient(uri, {
            serverApi: {
                version: ServerApiVersion.v1,
                strict: true,
                deprecationErrors: true,
            }
        });

        try {
            await client.connect();
            db = client.db("ResponseLogging");
            console.log("Connected to MongoDB");

            // Ensure indexes for faster lookups
            await db.collection('Tables').createIndex({ tableID: 1 }); // Index on tableID array elements
            await db.collection('Schedule').createIndex({ labNo: 1, startTime: 1, endTime: 1 }); // Index on labNo, startTime, and endTime
        } catch (error) {
            console.error("Error connecting to MongoDB", error);
            throw error;
        }
    }
}

async function getLabID(tableID) {
    try {
        // Extract room prefix from tableID (e.g., 3201 -> 32)
        const roomPrefix = parseInt(tableID / 100, 10);
        if (isNaN(roomPrefix)) {
            throw new Error(`Invalid tableID: ${tableID}`);
        }

        // Query Tables collection for room with this prefix
        const table = await db.collection('Tables').findOne({ tableID: roomPrefix });
        if (!table) {
            throw new Error(`No lab found for tableID: ${tableID}`);
        }

        // Extract labNo and ensure it's valid
        const labNo = table._id;
        if (!labNo) {
            throw new Error(`Invalid labNo retrieved for tableID: ${tableID}`);
        }

        // Get current time
        const currentTime = new Date();

        // Query Schedule collection for the current time
        const schedule = await db.collection('Schedule').findOne({
            labNo: labNo,
            startTime: { $lte: toIST(currentTime) },
            endTime: { $gte: toIST(currentTime) }
        });

        if (!schedule) {
            throw new Error(`No active lab found for labNo: ${labNo}`);
        }

        return schedule.labID;

    } catch (error) {
        console.error("Error in getLabID:", error);
        throw error; // Re-throw the error for further handling
    }
}

function pc_to_esp8266() {
    if (webSocket == null) {
        // Replace "<ESP8266_IP_ADDRESS>" with your ESP8266 IP address
        webSocket = new WebSocket(wsIPport);
        webSocket.onopen = ws_onopen;
        webSocket.onclose = ws_onclose;
        webSocket.onmessage = ws_onmessage;
        webSocket.binaryType = "arraybuffer";
    } else {
        webSocket.close();
    }
}

function ws_onopen() {
    console.log("WebSocket connected");
}

function ws_onclose() {
    console.log("WebSocket closed");
    webSocket.onopen = null;
    webSocket.onclose = null;
    webSocket.onmessage = null;
    webSocket = null;
}

async function ws_onmessage(e_msg) {
    e_msg = e_msg || window.Event; // MessageEvent
    console.log(e_msg.data);

    // Split the data string by '\t' to get individual values
    var values = e_msg.data.split('\t');
    // Ensure we have exactly 2 values
    if (values.length !== 2) {
        console.error('Expected 2 values, but received:', values);
        return; // Handle error or exit function if the format is incorrect
    }

    // Extract integers from the split array
    var tableID = parseInt(values[0].trim(), 10);
    var value = parseInt(values[1].trim(), 10);

    // Check if parsing was successful (isNaN check)
    if (isNaN(tableID) || isNaN(value)) {
        console.error('One or more values could not be parsed as integers.');
        return; // Handle error or exit function if parsing failed
    }

    var labID = await getLabID(tableID);
    // what to do with data
    if (value === 2) {
        await logToHelps(labID, tableID);
    } else {
        await logToResponses(labID, tableID, value);
    }
}

// Database section

async function logToHelps(labID, tableID) {
    const helpLoggingCollection = db.collection('Helps');

    // Check for the latest record with the same labID and tableID
    const latestRecord = await helpLoggingCollection.findOne(
        { labID: labID, tableID: tableID },
        { sort: { helpStarted: -1 } }
    );

    if (!latestRecord || latestRecord.helpEnded) {
        // If no record exists or the existing record already has helpEnded, create a new record
        const helpLoggingDoc = {
            labID: labID,
            tableID: tableID,
            helpStarted: new Date()
        };
        try {
            await helpLoggingCollection.insertOne(helpLoggingDoc);
            console.log('Inserted new document into Helps');
        } catch (error) {
            console.error("Error inserting document into Helps", error);
        }
    } else {
        // If the latest record exists and does not have helpEnded, update it
        try {
            await helpLoggingCollection.updateOne(
                { _id: latestRecord._id },
                { $set: { helpEnded: new Date() } }
            );
            console.log('Updated document in Helps with helpEnded');
        } catch (error) {
            console.error("Error updating document in Helps", error);
        }
    }
}

async function logToResponses(labID, tableID, value) {
    const responseLoggingCollection = db.collection('Responses');
    const responseLoggingDoc = {
        date: new Date(),
        response: value === 1 // true if value is 1, otherwise false
    };

    try {
        await responseLoggingCollection.updateOne(
            { labID: labID, tableID: tableID },
            { $set: responseLoggingDoc },
            { upsert: true } // This will insert the document if it doesn't exist
        );
        console.log('Updated or inserted document into Responses');
    } catch (error) {
        console.error("Error updating or inserting document into Responses", error);
    }
}

// Empties database
async function emptyCollection(collectionName) {
    try {
        const collection = db.collection(collectionName);
        const result = await collection.deleteMany({});
        console.log(`Deleted ${result.deletedCount} documents from the ${collectionName} collection`);
    } catch (error) {
        console.error(`Error emptying the ${collectionName} collection`, error);
    }
}

// Main function to connect to MongoDB and start WebSocket communication
async function main() {
    await connectToMongoDB();
    await emptyCollection("Helps");
    await emptyCollection("Responses");
    pc_to_esp8266();
}

// Test function
// Test function
async function test() {
    // Connect to MongoDB and prepare the environment
    await connectToMongoDB();
    await emptyCollection("Helps");
    await emptyCollection("Responses");

    // // Mock WebSocket messages
    // await ws_onmessage({ data: "9001\t2" });
    // await ws_onmessage({ data: "9001\t1" });
    // await ws_onmessage({ data: "10002\t0" });
    // await ws_onmessage({ data: "10002\t1" });
    // await ws_onmessage({ data: "9001\t0" });
    // await ws_onmessage({ data: "9001\t2" });
    //help table 9001 complete
    //response table, 9001 - false and 10002 - true

    // Complete logging test
    console.log('Test logToResponses complete');

    // Close the MongoDB client connection
    await client.close();
    console.log("Disconnected from MongoDB");
}

// Run the test function
test().catch(console.error);