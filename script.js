let mediaRecorder;
let audioChunks = [];
let audioURL;
let audioBlob;

const $ = (element)=> document.querySelector(element);

let getStartRecording = $('#btn-startRecording');
let getPlayRecording = $('#playbackButton');
let getTranscribeButton = $('#transcribeButton');


// Function to start recording
async function startRecording() {
    try {
        getStartRecording.classList.toggle("btnInUse");
        // Access user media (microphone)
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/mp3' }); // Ensure MIME type is correct
            audioURL = URL.createObjectURL(audioBlob)
            audioChunks = []; // Clear the chunks for next recording
            // Proceed with transcription here
            //transcribeAudio();

            // Habilitar el botón de reproducción
            document.getElementById('playbackButton').disabled = false;
        };

        mediaRecorder.start();
        console.log('Recording started');

        // Stop recording after 3 seconds
        setTimeout(() => {
            getPlayRecording.classList.toggle("btnDisabled");
            getStartRecording.classList.toggle("btnInUse");
            if (mediaRecorder.state === "recording") {
                mediaRecorder.stop();
                console.log('Recording stopped automatically after 3 seconds');
            }
        }, 3000); // 3000 ms = 3 seconds

    } catch (error) {
        console.error('Error starting recording:', error);
    }
}

/* Function to stop recording
function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        console.log('Recording stopped');
    } else {
        console.warn('No active recording to stop');
    }
}
*/

// Function to play the recording
function playRecording() {
    if (audioURL) {
        getPlayRecording.classList.toggle("btnInUse");
        const audioElement = new Audio(audioURL);
        audioElement.play();
        console.log('Playing recording');
        setTimeout(()=>{
            getPlayRecording.classList.toggle("btnInUse");
            // Habilitar el botón para enviar la grabación a la API después de la reproducción
            getTranscribeButton.disabled = false;
            getTranscribeButton.classList.toggle("btnDisabled");
        }, 3000)

    } else {
        console.warn('No recording available to play');
    }
}


// → AQUÍ HE ARREGLADO EL CÓDIGO Y AHORA YA MANDA EL ARCHIVO A ASSEMBLY AI CORRECTAMENTE.
// Function to handle transcription and comparison
async function transcribeAudio() {
    try {
        // Check audio blob type
        console.log(`Audio Blob Type: ${audioBlob.type}`);

        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'Authorization': '00851f1dd9334c58b62af06ef21c7de5',
            },
            body: audioBlob, // ESTE ES EL ARREGLO QUE HE HECHO. LO QUE SUBO ES DIRECTAMENTE EL OBJETO BLOB QUE HE CREADO CON LA GRABACIÓN.
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed with status ${uploadResponse.status}: ${await uploadResponse.text()}`);
        }

        const uploadData = await uploadResponse.json();
        console.log('Upload response:', uploadData);

        const audioUrl = uploadData.upload_url;

        console.log('Requesting transcription...');
        const transcriptionResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'Authorization': '00851f1dd9334c58b62af06ef21c7de5',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio_url: audioUrl,
            }),
        });

        if (!transcriptionResponse.ok) {
            throw new Error(`Transcription request failed with status ${transcriptionResponse.status}: ${await transcriptionResponse.text()}`);
        }

        const transcriptionData = await transcriptionResponse.json();
        console.log('Transcription request response:', transcriptionData);

        if (!transcriptionData.id) {
            throw new Error('Failed to get transcript ID');
        }

        const transcriptId = transcriptionData.id;
        let transcriptionCompleted = false;
        let transcribedText = '';

        // Poll for status every 5 seconds
        while (!transcriptionCompleted) {
            console.log('Polling for transcription status...');
            const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
                method: 'GET',
                headers: {
                    'Authorization': '00851f1dd9334c58b62af06ef21c7de5',
                },
            });

            if (!pollingResponse.ok) {
                throw new Error(`Polling failed with status ${pollingResponse.status}: ${await pollingResponse.text()}`);
            }

            const pollingData = await pollingResponse.json();
            console.log('Polling result:', pollingData);

            if (pollingData.status === 'completed') {
                transcribedText = pollingData.text.toLowerCase().trim();
                transcriptionCompleted = true;
                compareTexts(transcribedText);
            } else if (pollingData.status === 'failed') {
                throw new Error(`Transcription failed with error: ${pollingData.error}`);
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for 5 seconds before polling again
            }
        }

    } catch (error) {
        console.error('Error during transcription:', error);
        document.getElementById('comparisonResult').innerHTML = `<p style="color: red;">An error occurred: ${error.message}</p>`;
    }
}

// Function to compare the transcribed text with the sample sentence
function compareTexts(transcribedText) {
    const sampleSentence = document.getElementById('sampleSentence').textContent.toLowerCase().trim();
    const resultElement = document.getElementById('comparisonResult');

    if (transcribedText === sampleSentence) {
        resultElement.textContent = 'The transcription matches the sample sentence!';
        resultElement.style.color = 'green';
    } else {
        resultElement.textContent = `The transcription does not match the sample sentence. Transcribed text: "${transcribedText}"`;
        resultElement.style.color = 'red';
    }
}