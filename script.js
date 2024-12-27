const API_KEY = 'AIzaSyACE-0Rptd3iNetYGrMKj-AkRf4Shut0jU';
const MODEL = 'gemini-1.5-flash';

let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let startTime;
let timerInterval;
let currentChart = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    initializeRecording();
    initializeUpload();
});

function initializeTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.style.display = 'none');
            
            const targetTab = document.getElementById(`${tab.dataset.tab}-tab`);
            targetTab.style.display = 'block';
        });
    });
}

function initializeRecording() {
    const recordBtn = document.getElementById('recordBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = processRecording;
        
        mediaRecorder.start();
        isRecording = true;
        startTime = Date.now();
        updateTimer();
        
        document.getElementById('recordBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        
    } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Error accessing microphone. Please ensure you have granted microphone permissions.');
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        clearInterval(timerInterval);
        
        document.getElementById('recordBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
        
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

function updateTimer() {
    const timerElement = document.querySelector('.timer');
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}

async function processRecording() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = audioUrl;
    
    document.querySelector('.results-container').style.display = 'block';
    
    await analyzeEmotion(audioBlob);
    saveToHistory(audioUrl);
}

async function analyzeEmotion(audioBlob) {
    try {
        const base64Audio = await blobToBase64(audioBlob);
        
        const prompt = `Analyze this audio for emotional content. Detect the following emotions and their intensities:
            - Happiness
            - Sadness
            - Anger
            - Fear
            - Surprise
            - Disgust
            - Neutral
            
            Provide the results as percentages.`;
            
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }, {
                        inline_data: {
                            mime_type: "audio/wav",
                            data: base64Audio
                        }
                    }]
                }]
            })
        });

        const data = await response.json();
        if (data.candidates && data.candidates[0].content) {
            const results = parseEmotionResults(data.candidates[0].content.parts[0].text);
            displayResults(results);
        }
    } catch (error) {
        console.error('Error analyzing emotion:', error);
        alert('Error analyzing emotion. Please try again.');
    }
}

function parseEmotionResults(text) {
    // Mock results for demonstration
    return {
        Happiness: Math.random() * 100,
        Sadness: Math.random() * 100,
        Anger: Math.random() * 100,
        Fear: Math.random() * 100,
        Surprise: Math.random() * 100,
        Disgust: Math.random() * 100,
        Neutral: Math.random() * 100
    };
}

function displayResults(results) {
    // Destroy existing chart if it exists
    if (currentChart) {
        currentChart.destroy();
    }

    // Create new chart
    const ctx = document.getElementById('emotionChart').getContext('2d');
    currentChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(results),
            datasets: [{
                label: 'Emotion Intensity',
                data: Object.values(results),
                backgroundColor: 'rgba(108, 99, 255, 0.2)',
                borderColor: 'rgba(108, 99, 255, 1)',
                pointBackgroundColor: 'rgba(108, 99, 255, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(108, 99, 255, 1)'
            }]
        },
        options: {
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    // Update emotion list
    const emotionList = document.querySelector('.emotion-list');
    emotionList.innerHTML = '';
    Object.entries(results).forEach(([emotion, value]) => {
        const emotionItem = document.createElement('div');
        emotionItem.className = 'emotion-item';
        emotionItem.innerHTML = `
            <span>${emotion}</span>
            <span>${value.toFixed(1)}%</span>
        `;
        emotionList.appendChild(emotionItem);
    });
}

function initializeUpload() {
    const dropZone = document.querySelector('.drop-zone');
    const fileInput = document.getElementById('fileInput');
    
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            processUploadedFile(file);
        } else {
            alert('Please upload an audio file.');
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            processUploadedFile(file);
        }
    });
}

async function processUploadedFile(file) {
    const audioUrl = URL.createObjectURL(file);
    document.getElementById('audioPlayer').src = audioUrl;
    document.querySelector('.results-container').style.display = 'block';
    
    await analyzeEmotion(file);
    saveToHistory(audioUrl);
}

function saveToHistory(audioUrl) {
    const historyList = document.querySelector('.history-list');
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    const date = new Date().toLocaleString();
    historyItem.innerHTML = `
        <div>
            <strong>Recording ${date}</strong>
            <audio src="${audioUrl}" controls></audio>
        </div>
        <button onclick="reanalyzeAudio('${audioUrl}')">Reanalyze</button>
    `;
    
    historyList.insertBefore(historyItem, historyList.firstChild);
}

async function reanalyzeAudio(audioUrl) {
    try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        document.getElementById('audioPlayer').src = audioUrl;
        document.querySelector('.results-container').style.display = 'block';
        await analyzeEmotion(blob);
    } catch (error) {
        console.error('Error reanalyzing audio:', error);
        alert('Error reanalyzing audio. Please try again.');
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
