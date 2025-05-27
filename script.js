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

let recordingStartTime = 0;

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

        recordingStartTime = Date.now();

        mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

        mediaRecorder.onstop = () => {
            const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            saveRecording(duration);
        };

        mediaRecorder.start();

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        drawWaveform();

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
    recordButton.querySelector('.record-label').textContent = 'Record';

    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    if (canvasCtx && canvas) {
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function saveRecording(duration) {
    let recordings = JSON.parse(localStorage.getItem('recordings') || '[]');

    let blob = new Blob(audioChunks, { type: 'audio/webm' });
    let url = URL.createObjectURL(blob);
    let timestamp = new Date().toLocaleString();
    let title = `Recording - ${recordings.length + 1}`;

    recordings.push({ url, timestamp, title, duration });
    localStorage.setItem('recordings', JSON.stringify(recordings));

    renderRecordings();
}

function formatDateTime(inputString) {
    const date = new Date(inputString);
    const monthDay = date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
    });
    const time = date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
    return `${monthDay} · ${time}`;
}

let currentlyPlayingAudio = null;

function renderRecordings() {
    recordingsList.innerHTML = '';
    const recordings = JSON.parse(localStorage.getItem('recordings') || '[]');

    recordings.forEach((rec) => {
        const clone = recordTemplate.content.cloneNode(true);

        clone.querySelector('.audio-date').textContent = formatDateTime(rec.timestamp);
        clone.querySelector('.audio-title').textContent = rec.title || 'Untitled Recording';

        const audio = clone.querySelector('.hidden-audio');
        const playBtn = clone.querySelector('.play-toggle');
        const playIcon = playBtn.querySelector('img');
        const progressFill = clone.querySelector('.progress-fill');
        const progressThumb = clone.querySelector('.progress-thumb');
        const progressBar = clone.querySelector('.progress-bar');

        audio.src = rec.url;

        clone.querySelector('.duration').textContent = formatTime(rec.duration || 0);

        playBtn.addEventListener('click', () => {
            document.querySelectorAll('.hidden-audio').forEach((otherAudio) => {
                if (otherAudio !== audio) {
                    otherAudio.pause();
                    const otherPlayBtn = otherAudio.parentElement.querySelector('.play-toggle img');
                    if (otherPlayBtn) {
                        otherPlayBtn.src = '/public/icons/play-icon.svg';
                        otherPlayBtn.alt = 'Play';
                    }
                }
            });

            if (audio.paused) {
                audio.play();
                if (playIcon) {
                    playIcon.src = '/public/icons/pause-icon.svg';
                    playIcon.alt = 'Pause';
                }
                animateProgress(audio, progressFill, progressThumb);
            } else {
                audio.pause();
                if (playIcon) {
                    playIcon.src = '/public/icons/play-icon.svg';
                    playIcon.alt = 'Play';
                }
            }
        });

        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const percent = clickX / rect.width;
            audio.currentTime = percent * audio.duration;

            progressFill.style.width = `${percent * 100}%`;
            progressThumb.style.left = `${percent * 100}%`;
        });

        audio.addEventListener('ended', () => {
            if (playIcon) {
                playIcon.src = '/public/icons/play-icon.svg';
                playIcon.alt = 'Play';
            }
            progressFill.style.width = `0%`;
            progressThumb.style.left = `0%`;
        });

        recordingsList.appendChild(clone);
    });
}


function animateProgress(audio, progressFill, progressThumb) {
    function update() {
        if (!audio.paused && !audio.ended) {
            const percent = (audio.currentTime / audio.duration) * 100;
            progressFill.style.width = `${percent}%`;
            progressThumb.style.left = `${percent}%`;
            requestAnimationFrame(update);
        }
    }
    requestAnimationFrame(update);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

renderRecordings();
