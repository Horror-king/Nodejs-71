const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const axios = require('axios');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let aiMemory = {};

// Load learned prompts from file on startup
function loadMemory() {
    try {
        if (fs.existsSync('teach.txt')) {
            const data = fs.readFileSync('teach.txt', 'utf-8');
            aiMemory = JSON.parse(data);
            console.log('Memory loaded successfully:', aiMemory);
        } else {
            console.log('teach.txt file does not exist. Starting with empty memory.');
        }
    } catch (error) {
        console.error('Error loading AI memory:', error);
        aiMemory = {}; // Reset memory in case of error
    }
}

// Save learned prompts to file
function saveMemory() {
    try {
        fs.writeFileSync('teach.txt', JSON.stringify(aiMemory, null, 2));
        console.log('Memory saved successfully:', aiMemory);
    } catch (error) {
        console.error('Error saving AI memory:', error);
    }
}

// Initial load of AI memory
loadMemory();

let chatHistory = [];

// Serve the HTML file
app.use(express.static('public'));

// Function to check for word matches
function findBestMatch(userPrompt) {
    let bestMatch = null;
    let highestMatchCount = 0;
    const userWords = userPrompt.split(' ');

    Object.keys(aiMemory).forEach((learnedPrompt) => {
        const learnedWords = learnedPrompt.split(' ');
        const matchCount = userWords.filter(word => learnedWords.includes(word)).length;

        if (matchCount >= 5 && matchCount > highestMatchCount) {
            highestMatchCount = matchCount;
            bestMatch = learnedPrompt;
        }
    });

    return bestMatch;
}

// Handle AI queries
app.get('/ai', async (req, res) => {
    const userPrompt = req.query.prompt?.trim().toLowerCase();
    console.log('Received prompt:', userPrompt);

    if (userPrompt) {
        chatHistory.push({ prompt: userPrompt });

        if (aiMemory[userPrompt]) {
            const response = aiMemory[userPrompt];
            console.log('Found response:', response);
            chatHistory.push({ response });
            res.json({ response });
        } else {
            const bestMatch = findBestMatch(userPrompt);
            if (bestMatch) {
                const response = aiMemory[bestMatch];
                console.log('Found close match:', bestMatch, 'with response:', response);
                chatHistory.push({ response });
                res.json({ response });
            } else {
                console.log('No close match found, querying external API.');

                // Query the external API if response is not found in local memory
                try {
                    const apiResponse = await axios.get(`https://hassan-llama3-aipk.onrender.com/llama3?prompt=${encodeURIComponent(userPrompt)}`);
                    const externalResponse = apiResponse.data.response;

                    // Learn from the external API response
                    aiMemory[userPrompt] = externalResponse;
                    console.log('Learned from external API:', userPrompt, '->', externalResponse);
                    saveMemory(); // Save the updated AI memory to file

                    chatHistory.push({ response: externalResponse });
                    res.json({ response: externalResponse });
                } catch (error) {
                    console.error('Error fetching response from external API:', error);
                    res.json({ response: "Sorry, I couldn't fetch a response from the external API." });
                }
            }
        }
    } else {
        res.json({ response: "Please provide a prompt." });
    }
});

// Handle teaching new prompts
app.post('/teach', (req, res) => {
    let { prompt, response } = req.body;
    if (prompt && response) {
        const lowerCasePrompt = prompt.trim().toLowerCase();
        aiMemory[lowerCasePrompt] = response.trim();
        console.log('Learned:', lowerCasePrompt, '->', response);
        saveMemory(); // Save the updated AI memory to file
        res.json({ response: `Learned: "${prompt}" -> "${response}"` });
    } else {
        res.status(400).json({ response: "Invalid data format. Provide both 'prompt' and 'response'." });
    }
});

// Handle chat history retrieval
app.get('/history', (req, res) => {
    res.json({ response: chatHistory });
});

// Inspect the current AI memory
app.get('/inspectMemory', (req, res) => {
    res.json({ response: aiMemory });
});

// Start the server
app.listen(3000, () => {
    console.log('AI server is running on port 3000');
});
