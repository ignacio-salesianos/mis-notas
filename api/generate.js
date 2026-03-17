export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY environment variable is not set' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemma-2-27b-it:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7 }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Google API error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0].content.parts[0].text) {
            return res.status(200).json({ text: data.candidates[0].content.parts[0].text });
        }
        
        throw new Error('No content in response');

    } catch (error) {
        console.error('Error generating AI content:', error);
        
        // Fallback for Gemini 1.5 flash if Gemma fails
        try {
            const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            const fallbackResponse = await fetch(fallbackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7 }
                })
            });
            const fData = await fallbackResponse.json();
            if (fData.candidates && fData.candidates[0].content.parts[0].text) {
                return res.status(200).json({ text: fData.candidates[0].content.parts[0].text });
            }
        } catch (e) {
            console.error('Fallback failed:', e);
        }

        return res.status(500).json({ error: 'Failed to generate content' });
    }
}
