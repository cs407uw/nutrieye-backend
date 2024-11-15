import express from "express";
import * as bodyParser from "express";

const app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: true}));

app.post('/analyze', async (req, res) => {
    res.json({hello: "world"})
})



app.listen(4000, () => {
    console.log('Server is running on port 4000');
});