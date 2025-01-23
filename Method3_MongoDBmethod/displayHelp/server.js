require('dotenv').config({ path: "../.env" });
const bodyParser = require('body-parser');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = 4000;

const uri = process.env.MONGODB_URI;
const dbName = 'ResponseLogging';

app.set('view engine', 'ejs');

// Middleware for parsing request bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

let db;

async function connectToMongoDB() {
    const client = new MongoClient(uri, {
        serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
        }
    });
    try {
        await client.connect();
        db = client.db(dbName);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        throw error;
    }
}

function toIST(date) {
    // Convert UTC date to IST (UTC+5:30)
    const istOffset = 5 * 60 + 30; // IST is UTC+5:30
    return new Date(date.getTime() + istOffset * 60 * 1000);
}

function updateIST(date) {
    // Convert UTC date to IST (UTC+5:30)
    const istOffset = 5 * 60 + 30; // IST is UTC+5:30
    return new Date(date.getTime() - istOffset * 60 * 1000);
}

app.get('/', async (req, res) => {
try {
    const currentTime = toIST(new Date());
    console.log('Current date and time in IST:', currentTime.toISOString());

    // Get ongoing schedules
    const ongoingSchedules = await db.collection('Schedule').find({
        startTime: { $lte: currentTime },
        endTime: { $gte: currentTime }
    }).toArray();

    console.log('Ongoing schedules:', ongoingSchedules);

    if (ongoingSchedules.length === 0) {
        console.log('No ongoing schedules found.');
    }

    // Extract labNumbers and labIDs
    const ongoingLabNumbers = ongoingSchedules
        .map(schedule => ({
            labID: schedule.labID,
            labNumber: schedule.labNo
        }))
        .sort((a, b) => {
            // Extract numeric part for sorting
            const labNumberA = a.labNumber.match(/\d+$/);
            const labNumberB = b.labNumber.match(/\d+$/);

            if (labNumberA && labNumberB) {
                return parseInt(labNumberA[0], 10) - parseInt(labNumberB[0], 10);
            }

            return a.labNumber.localeCompare(b.labNumber);
        }); // Sort room numbers

    console.log('Sorted lab numbers:', ongoingLabNumbers);

    res.render('index', { labs: ongoingLabNumbers });

} catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send(error);
}
});

app.get('/lab/:labID', async (req, res) => {
    const { labID } = req.params;
    try {
        // Fetch unresolved helps for the specific labID
        const unresolvedHelps = await db.collection('UnresolvedHelps').find({
            labID: labID
        }).toArray();

        // Convert unresolvedHelps to IST
        const unresolvedHelpsInIST = unresolvedHelps.map(help => ({
            ...help,
            issueRaised: (new Date()) // Convert issueRaised to IST
        }));

        // Fetch active helps for the specific labID
        const helps = await db.collection('Helps').find({
            labID: labID,
            helpEnded: { $exists: false }
        }).toArray();

        // Convert helpStarted to IST for the specific lab
        const helpsInIST = helps.map(help => ({
            ...help,
            // helpStarted: updateIST(new Date(help.helpStarted)) // Convert helpStarted to IST
            helpStarted: new Date(help.helpStarted)
        }));

        // Fetch the lab number
        const lab = await db.collection('Schedule').findOne({ labID: labID });
        const labNumber = lab ? lab.labNo : 'Unknown Lab Number';

        console.log('Helps for labID:', labID, helpsInIST);
        console.log('Unresolved Helps for labID:', labID, unresolvedHelpsInIST);

        res.render('lab', { labNumber, helps:helpsInIST, UnresolvedHelps: unresolvedHelpsInIST });
    } catch (error) {
        console.error("Error fetching data:", error);
        res.status(500).send(error);
    }
});

async function getLabID(tableID) {
    try {
        tableID = parseInt(tableID / 1000, 10);
        if (isNaN(tableID)) {
            throw new Error(`Invalid tableID: ${tableID}`);
        }

        const table = await db.collection('Tables').findOne({ tableID: tableID });
        if (!table) {
            throw new Error(`No lab found for tableID: ${tableID}`);
        }

        const labNo = table._id;
        if (!labNo) {
            throw new Error(`Invalid labNo retrieved for tableID: ${tableID}`);
        }

        const currentTime = toIST(new Date());
        console.log("Current Time: ");
        console.log(currentTime);

        const schedule = await db.collection('Schedule').findOne({
            labNo: labNo,
            startTime: { $lte: (currentTime) },
            endTime: { $gte: (currentTime) }
        });

        if (!schedule) {
            throw new Error(`No active lab found for labNo: ${labNo}`);
        }

        return schedule.labID;

    } catch (error) {
        console.error("Error in getLabID:", error);
        throw error;
    }
}

app.post('/log-issue', async (req, res) => {
    const { tableID, issue, time } = req.body;
    try {
        const labID = await getLabID(tableID); // Retrieve labID based on tableID
        
        // Prepare the new issue record
        const newIssue = {
            labID: labID,
            tableID: parseInt(tableID),
            issue,
            issueRaised: new Date(time)
        };
        console.log("Inseting unresolved:",newIssue);
        
        // Insert the new issue into UnresolvedHelps
        await db.collection('UnresolvedHelps').insertOne(newIssue);

        // Delete the corresponding record from Helps
        await db.collection('Helps').deleteOne({
            tableID: parseInt(tableID),
            helpEnded: { $exists: false }
        });

        res.json({ success: true });
    } catch (error) {
        console.error("Error logging issue:", error);
        res.json({ success: false });
    }
});



// Connect to MongoDB and start the server
connectToMongoDB().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}).catch(error => {
    console.error("Failed to start server due to MongoDB connection error", error);
});

// to run
// cd D:\Chirag\VSCode\GITI\Method3_MongoDBmethod\displayHelp       
// node server.js
