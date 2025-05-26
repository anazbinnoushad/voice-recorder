let recordButton = document.getElementById('recordButton');
let recordingsList = document.getElementById('recordingsList');
let recordTemplate = document.getElementById('recordTemplate');

let canvas = document.getElementById('waveformCanvas');
let canvasCtx = canvas.getContext('2d');
let animationId;

let mediaRecorder;
let audioChunks = [];
let audioContext, analyser, source;
let isRecording = false;

recordButton.onclick = async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
};

function drawWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    const ctx = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        animationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;

        ctx.fillStyle = '#A8C0FF';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 255;
            const y = height - (v * height);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
    }

    draw();
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Your browser doesn't support audio recording.");
        return;
    }

    try {
        let stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
        mediaRecorder.onstop = saveRecording;
        mediaRecorder.start();

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        drawWaveform()

        recordButton.querySelector('.record-label').textContent = '■ Stop';
        isRecording = true;
    } catch (err) {
        alert("Microphone access is required to record audio.");
        console.error("Error accessing microphone:", err);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }

    if (audioContext) {
        audioContext.close();
    }

    isRecording = false;
    recordButton.querySelector('.record-label').textContent = '● Record';

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (canvasCtx && canvas) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function saveRecording() {
    let recordings = JSON.parse(localStorage.getItem('recordings') || '[]');

    let blob = new Blob(audioChunks, { type: 'audio/webm' });
    let url = URL.createObjectURL(blob);
    let timestamp = new Date().toLocaleString();
    let title = `Recording - ${recordings.length + 1}`;

    recordings.push({ url, timestamp, title });
    localStorage.setItem('recordings', JSON.stringify(recordings));

    renderRecordings();
}

function renderRecordings() {
    recordingsList.innerHTML = '';
    const recordings = JSON.parse(localStorage.getItem('recordings') || '[]');

    recordings.forEach((rec) => {
        const clone = recordTemplate.content.cloneNode(true);

        clone.querySelector('.audio-date').textContent = rec.timestamp;
        clone.querySelector('.audio-title').textContent = rec.title || 'Untitled Recording';

        const audioEl = clone.querySelector('.audio-player');
        audioEl.src = rec.url;

        audioEl.onended = () => URL.revokeObjectURL(audioEl.src);

        recordingsList.appendChild(clone);
    });
}

renderRecordings();
