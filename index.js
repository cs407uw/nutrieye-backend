import express from "express";
import * as bodyParser from "express";
import OpenAI from 'openai';
import 'dotenv/config';
import {zodResponseFormat} from "openai/helpers/zod";
import {z} from "zod";
import axios from "axios";

const app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({extended: true}));

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const Items = z.object({
    items: z.array(z.object({
        name: z.string().describe("The name of the item"),
        calories: z.number().describe("The estimated amount of calories")
    })).describe("The list of items found in the image")
});

async function lookupBarcode(barcode) {
    console.log("looking up barcode " + barcode)
    try {
        const response = await axios.get('https://www.google.com/search', {
            params: {
                q: barcode,
                brd_json: 1,
            },
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
            },
            proxy: {
                host: 'brd.superproxy.io',
                port: 22225,
                auth: {
                    username: process.env.BRIGHTDATA_USERNAME,
                    password: process.env.BRIGHTDATA_PASSWORD,
                },
            },
        });

        const data = response.data;

        console.log("Data is", JSON.stringify(data))
        console.log("data organic is ", data.organic);

        let organic = data.organic.map((item) => item.description).join(', ');

        console.log(organic);

        return `Results from Google search about the barcode: ${organic}`;
    } catch (error) {
        console.error(error);
        return 'Error fetching product information.';
    }
}

app.post('/analyze', async (req, res) => {
    const imageData = req.body.image;
    const clientBarcodes = req.body.barcodes || [];

    const functions = [
        {
            name: 'lookup_barcode',
            description: 'Lookup product information by barcode number.',
            parameters: {
                type: 'object',
                properties: {
                    barcode: {
                        type: 'string',
                        description: 'The barcode number to look up.',
                    },
                },
                required: ['barcode'],
            },
        },
    ];

    let messages = [
        {
            role: 'system',
            content:
                'You are a helpful assistant that analyzes food images and estimates calorie content. If barcodes are provided, you can use the lookup_barcode function to get product details.',
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

    if (clientBarcodes.length > 0) {
        const barcodesList = clientBarcodes.join(', ');
        userMessageContent.push({
            type: 'text',
            text: `The image contains barcodes with numbers: ${barcodesList}. Please use the lookup_barcode function to get product details, if needed`,
        });
    }

    messages.push({
        role: 'user',
        content: userMessageContent,
    });

    let response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: messages,
        functions: functions,
        function_call: 'auto',
        response_format: zodResponseFormat(Items, "items")
    });

    let assistantMessage = response.choices[0].message;

    while (assistantMessage.function_call) {
        const functionName = assistantMessage.function_call.name;
        const functionArgs = JSON.parse(assistantMessage.function_call.arguments);

        let functionResponse;

        if (functionName === 'lookup_barcode') {
            functionResponse = await lookupBarcode(functionArgs.barcode);
        } else {
            functionResponse = 'Function not implemented';
        }

        console.log('functionResponse', functionResponse);

        messages.push({
            role: 'function',
            name: functionName,
            content: functionResponse,
        });

        response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            response_format: zodResponseFormat(Items, "items")
        });

        assistantMessage = response.choices[0].message;
    }

    res.json({result: JSON.parse(assistantMessage.content)});
})

app.listen(4000, () => {
    console.log('Server is running on port 4000');
});