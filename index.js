import express from "express";
import * as bodyParser from "express";
import OpenAI from 'openai';
import 'dotenv/config';
import {zodResponseFormat} from "openai/helpers/zod";
import {z} from "zod";

const app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: true}));

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const Items = z.object({
    items: z.array(z.object({
        name: z.string().describe("The name of the item"),
        calories: z.number().describe("The estimated amount of calories")
    })).describe("The list of items found in the image")
});

app.post('/analyze', async (req, res) => {
    const imageData = req.body.image;

    let messages = [
        {
            role: 'system',
            content:
                'You are a helpful assistant that analyzes food images and estimates calorie content.',
        },
    ];

    let userMessageContent = [
        {type: 'text', text: 'Analyze the calorie content of the food in this image.'},
        {
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${imageData}`,
            },
        },
    ];

    messages.push({
        role: 'user',
        content: userMessageContent,
    });

    let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        response_format: zodResponseFormat(Items, "items")
    });

    let assistantMessage = response.choices[0].message;

    res.json({result: JSON.parse(assistantMessage.content)});
})

app.listen(4000, () => {
    console.log('Server is running on port 4000');
});