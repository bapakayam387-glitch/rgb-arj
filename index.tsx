/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Let TypeScript know Chart.js is available globally
declare var Chart: any;

// Interface for our prediction history records
interface PredictionRecord {
  id: number;
  marketName: string;
  marketDate: string;
  inputs: string[];
  prediction: {
    prediction_2_digit: string;
    prediction_3_digit: string;
    prediction_4_digit: string;
    cb: string;
    bbfs: string;
    bb_3d: string;
    bb_2d: string;
    confidence: string;
    reasoning: string;
  };
  actualResult: string | null;
}

const predictButton = document.getElementById('predict-btn') as HTMLButtonElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
const errorContainer = document.getElementById('error-container') as HTMLDivElement;
const errorMessageElement = document.getElementById('error-message') as HTMLParagraphElement;
const marketName = document.getElementById('market-name') as HTMLElement;
const marketDate = document.getElementById('market-date') as HTMLElement;

const result2d = document.getElementById('result-2d') as HTMLParagraphElement;
const result3d = document.getElementById('result-3d') as HTMLParagraphElement;
const result4d = document.getElementById('result-4d') as HTMLParagraphElement;
const resultTunggal = document.getElementById('result-tunggal') as HTMLParagraphElement;
const resultBbfs = document.getElementById('result-bbfs') as HTMLParagraphElement;
const resultBb3d = document.getElementById('result-bb3d') as HTMLParagraphElement;
const resultBb2d = document.getElementById('result-bb2d') as HTMLParagraphElement;

// New DOM Elements for history and confidence
const confidenceLevel = document.getElementById('confidence-level') as HTMLSpanElement;
const confidenceReasoning = document.getElementById('confidence-reasoning') as HTMLParagraphElement;
const historyContainer = document.getElementById('history-container') as HTMLDivElement;
const chartCanvas = document.getElementById('prediction-chart') as HTMLCanvasElement;
const historyTableWrapper = document.getElementById('history-table-wrapper') as HTMLDivElement;

const inputIds = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6'];
const inputElements = inputIds.map(
  (id) => document.getElementById(id) as HTMLInputElement
);

let predictionChart: any = null; // To hold the chart instance
const MAX_HISTORY_ITEMS = 30;

async function handlePrediction() {
  // 1. UI Setup
  predictButton.disabled = true;
  predictButton.querySelector('.button-text')!.textContent = 'Mencari Angka Jitu...';
  resultsContainer.classList.add('hidden');
  errorContainer.classList.add('hidden');
  loader.classList.remove('hidden');

  // 2. Get and validate inputs
  const inputValues = inputElements.map((el) => el.value);
  if (inputValues.some((val) => !/^\d{4}$/.test(val))) {
    showError('Harap masukkan 4 digit angka untuk setiap hari.');
    resetButton();
    return;
  }
  
  const marketNameText = marketName.textContent?.trim() || '';
  const marketDateText = marketDate.textContent?.trim() || '';
  const marketText = `${marketNameText} ${marketDateText}`.trim() || 'pasaran umum';
  const formattedInputs = inputValues.map((val, i) => `Hari ${i+1}: ${val}`).join('\n');

  // 3. Construct Prompt
  const prompt = `
    Anda adalah sistem prediksi ARJ, seorang master prediksi togel dengan spesialisasi utama pada 2D (dua digit terakhir).
    Tugas Anda adalah menganalisis 6 angka keluaran terakhir untuk pasaran **${marketText}** dengan **fokus utama untuk menemukan prediksi 2D yang paling jitu dan akurat** untuk keluaran berikutnya (Hari ke-7).
    Gunakan semua keahlian Anda, termasuk perhitungan matematis, analisis pola frekuensi, pola mistis, dan numerologi, namun **prioritaskan metode yang paling efektif untuk memprediksi 2D**.

    Berikut adalah urutan angkanya:
    ${formattedInputs}

    Meskipun fokus utama Anda adalah 2D, berikan juga prediksi lainnya sebagai pelengkap.
    Berdasarkan analisis mendalam Anda (terutama untuk 2D), berikan:
    1. Prediksi 2D yang paling jitu (2 digit terakhir) untuk Hari 7.
    2. Prediksi untuk 3 digit terakhir (3D) untuk Hari 7, yang selaras dengan prediksi 2D Anda.
    3. Prediksi untuk angka 4 digit penuh (4D) untuk Hari 7, yang selaras dengan prediksi 2D Anda.
    4. Prediksi Colok Bebas (CB) yang paling jitu (1 digit).
    5. Rekomendasi angka Bolak Balik Full Set (BBFS), biasanya 5-7 digit.
    6. Rekomendasi angka Bolak Balik untuk 3D (BB 3D), berikan 4 angka (masing-masing 3 digit) yang dipisahkan oleh tanda '*'.
    7. Rekomendasi angka Bolak Balik untuk 2D (BB 2D), berikan 6 angka (masing-masing 2 digit) yang dipisahkan oleh tanda '*'.
    8. Tingkat kepercayaan Anda pada prediksi 2D ini (misalnya, "Tinggi", "Sedang", "Rendah") dan berikan alasan singkat.

    Berikan jawaban Anda dalam format JSON yang ketat.
  `;
  
  // 4. Define Response Schema
  const responseSchema = {
    type: "OBJECT",
    properties: {
      prediction_2_digit: { type: "STRING", description: 'Prediksi 2 digit terakhir yang paling akurat (format: "XX").' },
      prediction_3_digit: { type: "STRING", description: 'Prediksi 3 digit terakhir (format: "XXX").' },
      prediction_4_digit: { type: "STRING", description: 'Prediksi 4 digit penuh (format: "XXXX").' },
      cb: { type: "STRING", description: 'Prediksi Colok Bebas (CB) yang paling jitu (1 digit).' },
      bbfs: { type: "STRING", description: 'Rekomendasi angka Bolak Balik Full Set (BBFS), 5-7 digit.' },
      bb_3d: { type: "STRING", description: 'Rekomendasi 4 angka Bolak Balik untuk 3D (BB 3D), dipisahkan oleh tanda *. Contoh: "123*456*789*012".' },
      bb_2d: { type: "STRING", description: 'Rekomendasi 6 angka Bolak Balik untuk 2D (BB 2D), dipisahkan oleh tanda *. Contoh: "12*34*56*78*90*11".' },
      confidence: { type: "STRING", description: 'Tingkat kepercayaan prediksi (Tinggi/Sedang/Rendah).' },
      reasoning: { type: "STRING", description: 'Alasan singkat untuk tingkat kepercayaan.' },
    },
    required: ['prediction_2_digit', 'prediction_3_digit', 'prediction_4_digit', 'cb', 'bbfs', 'bb_3d', 'bb_2d', 'confidence', 'reasoning']
  };

  try {
    // 5. Call our secure Netlify Function
    const response = await fetch('/.netlify/functions/gemini-predict', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, responseSchema }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Terjadi kesalahan pada server.');
    }
    
    // 6. Process and Display Response
    const resultJson = await response.json();

    result2d.textContent = resultJson.prediction_2_digit;
    result3d.textContent = resultJson.prediction_3_digit;
    result4d.textContent = resultJson.prediction_4_digit;
    resultTunggal.textContent = resultJson.cb;
    resultBbfs.textContent = resultJson.bbfs;
    resultBb3d.textContent = resultJson.bb_3d;
    resultBb2d.textContent = resultJson.bb_2d;
    confidenceLevel.textContent = resultJson.confidence;
    confidenceReasoning.textContent = resultJson.reasoning;

    // Save the prediction to history
    const newRecord: PredictionRecord = {
        id: Date.now(),
        marketName: marketNameText,
        marketDate: marketDateText,
        inputs: inputValues,
        prediction: resultJson,
        actualResult: null,
    };
    savePrediction(newRecord);
    renderHistory(); // Re-render history with the new data

    resultsContainer.classList.remove('hidden');
  } catch (error) {
    console.error('Error during prediction:', error);
    showError((error as Error).message || 'Terjadi kesalahan saat menghubungi sistem ARJ. Silakan coba lagi.');
  } finally {
    // 7. Reset UI
    loader.classList.add('hidden');
    resetButton();
  }
}

function showError(message: string) {
  errorMessageElement.textContent = message;
  errorContainer.classList.remove('hidden');
  loader.classList.add('hidden');
}

function resetButton() {
  predictButton.disabled = false;
  predictButton.querySelector('.button-text')!.textContent = 'Prediksi Angka Jitu';
}

// --- History and Chart Functions ---

function getHistory(): PredictionRecord[] {
  try {
    const historyJson = localStorage.getItem('predictionHistory');
    return historyJson ? JSON.parse(historyJson) : [];
  } catch (e) {
    console.error("Could not parse history from localStorage", e);
    return [];
  }
}

function saveHistory(history: PredictionRecord[]): void {
  try {
    const trimmedHistory = history.slice(-MAX_HISTORY_ITEMS);
    localStorage.setItem('predictionHistory', JSON.stringify(trimmedHistory));
  } catch(e) {
    console.error("Could not save history to localStorage", e);
  }
}

function savePrediction(record: PredictionRecord): void {
  const history = getHistory();
  history.push(record);
  saveHistory(history);
}

function updateActualResult(id: number, actualResult: string): void {
  if (!/^\d{4}$/.test(actualResult)) {
    alert('Harap masukkan 4 digit angka untuk hasil aktual.');
    return;
  }
  const history = getHistory();
  const recordIndex = history.findIndex((rec) => rec.id === id);
  if (recordIndex > -1) {
    history[recordIndex].actualResult = actualResult;
    saveHistory(history);
    renderHistory();
  }
}

function renderHistoryTable(history: PredictionRecord[]): void {
  if (history.length === 0) {
    historyTableWrapper.innerHTML = '<p>Belum ada riwayat prediksi.</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'history-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Tanggal</th>
        <th>Prediksi 2D</th>
        <th>Kepercayaan</th>
        <th>Hasil Aktual (4D)</th>
        <th>Aksi</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody')!;
  history.slice().reverse().forEach(record => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${record.marketDate}</td>
      <td>${record.prediction.prediction_2_digit}</td>
      <td>${record.prediction.confidence}</td>
      <td><input type="text" maxlength="4" pattern="\\d{4}" placeholder="----" value="${record.actualResult || ''}"></td>
      <td><button class="update-btn">Simpan</button></td>
    `;
    const input = tr.querySelector('input')!;
    const button = tr.querySelector('button')!;
    button.addEventListener('click', () => {
      updateActualResult(record.id, input.value);
    });
    tbody.appendChild(tr);
  });

  historyTableWrapper.innerHTML = '';
  historyTableWrapper.appendChild(table);
}

function renderPredictionChart(history: PredictionRecord[]): void {
  if (predictionChart) {
    predictionChart.destroy();
  }
  
  if (history.length < 1) {
    chartCanvas.style.display = 'none';
    return;
  }
  chartCanvas.style.display = 'block';

  const labels = history.map(rec => rec.marketDate || new Date(rec.id).toLocaleDateString());
  const predicted2D = history.map(rec => parseInt(rec.prediction.prediction_2_digit, 10));
  const actual2D = history.map(rec => rec.actualResult ? parseInt(rec.actualResult.substring(2), 10) : null);

  predictionChart = new Chart(chartCanvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Prediksi 2D',
          data: predicted2D,
          borderColor: 'hsl(180, 100%, 60%)',
          backgroundColor: 'hsla(180, 100%, 60%, 0.2)',
          tension: 0.2,
          fill: true,
        },
        {
          label: 'Aktual 2D',
          data: actual2D,
          borderColor: 'hsl(0, 100%, 60%)',
          backgroundColor: 'hsla(0, 100%, 60%, 0.2)',
          tension: 0.2,
          fill: true,
        }
      ]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                max: 99,
                ticks: { color: 'var(--text-secondary-color)' },
                grid: { color: 'var(--border-color)' }
            },
            x: {
                ticks: { color: 'var(--text-secondary-color)' },
                grid: { color: 'var(--border-color)' }
            }
        },
        plugins: {
            legend: {
                labels: { color: 'var(--text-color)' }
            },
            tooltip: {
                backgroundColor: 'var(--surface-color)',
                titleColor: 'var(--text-color)',
                bodyColor: 'var(--text-color)',
            }
        }
    }
  });
}

function renderHistory(): void {
  const history = getHistory();
  if (history.length === 0) {
    historyContainer.classList.add('hidden');
    return;
  }
  historyContainer.classList.remove('hidden');
  renderHistoryTable(history);
  renderPredictionChart(history);
}

// Initial Load
document.addEventListener('DOMContentLoaded', renderHistory);
predictButton.addEventListener('click', handlePrediction);
