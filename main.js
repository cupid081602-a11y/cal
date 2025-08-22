// 예정임대요율 예측 계산기 - Main JavaScript

// 전역 변수
let currentStep = 1;
let ratesData = new Array(15).fill(null);
let frequencyData = new Array(15).fill(0);
let calculationResult = null;
let savedScenarios = [];
let frequencyChart = null;
let rateVsFrequencyChart = null;

// DOM이 로드되면 실행
document.addEventListener('DOMContentLoaded', initializeApp);

// 앱 초기화
function initializeApp() {
    createRateInputFields();
    setupEventListeners();
    loadSavedScenarios();
    updateTotalExpected();
}

// 요율 입력 필드 동적 생성
function createRateInputFields() {
    const container = document.getElementById('rate-inputs-container');
    if (!container) return; // 컨테이너가 없으면 함수 종료

    container.innerHTML = ''; // 기존 내용을 비웁니다.
    for (let i = 0; i < 15; i++) {
        const num = i + 1;
        const group = document.createElement('div');
        group.className = 'rate-input-group';
        group.innerHTML = `
            <label for="rate${num}" class="font-semibold text-gray-700 w-12 text-center">${num}번</label>
            <div class="flex items-center flex-1">
                <input type="number" 
                       id="rate${num}" 
                       class="rate-input w-full" 
                       placeholder="0.0000" 
                       step="0.0001" 
                       min="0" 
                       max="100"
                       data-index="${i}">
                <span class="ml-2 text-gray-600">%</span>
            </div>
        `;
        container.appendChild(group);
    }
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // Step 1 이벤트
    document.getElementById('loadSampleData').addEventListener('click', loadSampleData);
    document.getElementById('nextStep1').addEventListener('click', goToStep2);
    
    // Step 2 이벤트
    document.getElementById('prevStep2').addEventListener('click', goToStep1);
    document.getElementById('nextStep2').addEventListener('click', goToStep3);
    document.getElementById('autoDistribute').addEventListener('click', autoDistributeFrequency);
    document.getElementById('expectedBidders').addEventListener('input', updateTotalExpected);
    document.getElementById('selectionsPerBidder').addEventListener('input', updateTotalExpected);
    
    // Step 3 이벤트
    document.getElementById('prevStep3').addEventListener('click', goToStep2FromStep3);
    document.getElementById('newCalculation').addEventListener('click', startNewCalculation);
    document.getElementById('saveScenario').addEventListener('click', saveCurrentScenario);
    
    // 도움말 모달
    document.getElementById('helpBtn').addEventListener('click', showHelpModal);
    document.getElementById('closeHelp').addEventListener('click', hideHelpModal);
    
    // 요율 입력 필드 이벤트 (이벤트 위임 사용)
    const container = document.getElementById('rate-inputs-container');
    container.addEventListener('input', function(e) {
        if (e.target && e.target.classList.contains('rate-input')) {
            const input = e.target;
            const index = parseInt(input.dataset.index);
            
            // 소수점 5자리에서 자르기 (입력 제한)
            if (input.value.includes('.')) {
                input.value = input.value.slice(0, input.value.indexOf('.') + 5);
            }
            
            ratesData[index] = parseFloat(input.value) || null;
            
            // 입력된 필드 스타일 변경
            const group = input.closest('.rate-input-group');
            if (input.value) {
                group.classList.add('filled');
            } else {
                group.classList.remove('filled');
            }
        }
    });
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('helpModal').addEventListener('click', function(e) {
        if (e.target.id === 'helpModal') {
            hideHelpModal();
        }
    });
}

// 샘플 데이터 로드
function loadSampleData() {
    const sampleRates = [
        8.1234, 8.2345, 8.3456, 8.4567, 8.5678,
        8.6789, 8.7890, 8.8901, 8.9012, 9.0123,
        9.1234, 9.2345, 9.3456, 9.4567, 9.5678
    ];
    
    sampleRates.forEach((rate, index) => {
        const input = document.getElementById(`rate${index + 1}`);
        if (input) {
            input.value = rate;
            ratesData[index] = rate;
            input.closest('.rate-input-group').classList.add('filled');
        }
    });
    
    document.querySelectorAll('.rate-input-group').forEach(group => {
        group.classList.add('success-animation');
        setTimeout(() => group.classList.remove('success-animation'), 500);
    });
}

// Step 1 -> Step 2
function goToStep2() {
    const filledCount = ratesData.filter(rate => rate !== null && rate !== '').length;
    
    if (filledCount < 15) {
        alert(`모든 복수예비임대요율을 입력해주세요.\n현재 ${filledCount}/15개 입력됨`);
        
        document.querySelectorAll('.rate-input').forEach((input) => {
            if (!input.value) {
                input.closest('.rate-input-group').classList.add('error-shake');
                setTimeout(() => input.closest('.rate-input-group').classList.remove('error-shake'), 500);
            }
        });
        return;
    }
    
    createFrequencyTable();
    updateFrequencyCalculations();
    showStep(2);
}

// 빈도 테이블 생성
function createFrequencyTable() {
    const tbody = document.getElementById('frequencyTableBody');
    tbody.innerHTML = '';
    
    ratesData.forEach((rate, index) => {
        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50";
        row.innerHTML = `
            <td class="border border-gray-300 px-4 py-2 font-medium text-center">${index + 1}번</td>
            <td class="border border-gray-300 px-4 py-2 text-right">${rate.toFixed(4)}%</td>
            <td class="border border-gray-300 p-1">
                <input type="number" 
                       class="frequency-input w-full text-center" 
                       id="freq${index + 1}"
                       data-index="${index}"
                       min="0" 
                       step="1"
                       value="${frequencyData[index] || 0}">
            </td>
            <td class="border border-gray-300 px-4 py-2 text-right percentage-cell">0.0%</td>
        `;
        tbody.appendChild(row);
    });
    
    tbody.addEventListener('input', e => {
        if (e.target && e.target.classList.contains('frequency-input')) {
            updateFrequencyCalculations();
        }
    });
}

// 빈도 계산 업데이트
function updateFrequencyCalculations() {
    let total = 0;
    const expectedBidders = parseInt(document.getElementById('expectedBidders').value) || 0;
    const selectionsPerBidder = parseInt(document.getElementById('selectionsPerBidder').value) || 0;
    const expectedTotal = expectedBidders * selectionsPerBidder;
    
    document.querySelectorAll('.frequency-input').forEach((input) => {
        const index = parseInt(input.dataset.index);
        const value = parseInt(input.value) || 0;
        frequencyData[index] = value;
        total += value;
    });
    
    document.getElementById('totalFrequency').textContent = `${total}회`;
    
    document.querySelectorAll('.percentage-cell').forEach((cell, index) => {
        const percentage = total > 0 ? (frequencyData[index] / total * 100).toFixed(1) : 0;
        cell.textContent = `${percentage}%`;
    });
    
    const totalPercentageEl = document.getElementById('totalPercentage');
    totalPercentageEl.textContent = expectedTotal > 0 ? `(${(total / expectedTotal * 100).toFixed(1)}%)` : '';
    
    const totalFreqCell = document.getElementById('totalFrequency');
    if (total !== expectedTotal) {
        totalFreqCell.classList.add('text-red-500');
        totalFreqCell.classList.remove('text-green-600');
    } else {
        totalFreqCell.classList.remove('text-red-500');
        totalFreqCell.classList.add('text-green-600');
    }
}

// 총 예상 선택 횟수 업데이트
function updateTotalExpected() {
    const bidders = parseInt(document.getElementById('expectedBidders').value) || 0;
    const selections = parseInt(document.getElementById('selectionsPerBidder').value) || 0;
    document.getElementById('totalExpectedSelections').textContent = `${bidders * selections}회`;
    if (currentStep === 2) {
      updateFrequencyCalculations();
    }
}

// 자동 분배
function autoDistributeFrequency() {
    const total = parseInt(document.getElementById('totalExpectedSelections').textContent) || 200;
    
    const mean = 7; 
    const stdDev = 3;
    let distributedTotal = 0;
    const distribution = [];
    
    for (let i = 0; i < 15; i++) {
        const probability = Math.exp(-0.5 * Math.pow((i - mean) / stdDev, 2));
        distribution.push(probability);
    }
    
    const sum = distribution.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < 14; i++) {
        const value = Math.round((distribution[i] / sum) * total);
        frequencyData[i] = value;
        distributedTotal += value;
    }
    frequencyData[14] = total - distributedTotal; // 마지막 값에 오차 보정

    frequencyData.forEach((value, index) => {
         const input = document.getElementById(`freq${index + 1}`);
        if (input) input.value = value;
    })
    
    updateFrequencyCalculations();
}

// Step 2 -> Step 3 (계산 실행)
function goToStep3() {
    const total = frequencyData.reduce((sum, freq) => sum + freq, 0);
    
    if (total === 0) {
        alert('예상 선택 횟수를 1회 이상 입력해주세요.');
        return;
    }
    
    performCalculation();
    displayResults();
    createCharts();
    showStep(3);
}

// 예정임대요율 계산
function performCalculation() {
    const dataWithFreq = ratesData.map((rate, index) => ({
        number: index + 1,
        rate: rate,
        frequency: frequencyData[index]
    }));

    const sortedData = dataWithFreq.sort((a, b) => {
        if (b.frequency !== a.frequency) return b.frequency - a.frequency;
        return a.number - b.number;
    });
    
    const top5 = sortedData.slice(0, 5);
    const top5SortedByRate = [...top5].sort((a, b) => b.rate - a.rate);
    const selectedForAverage = top5SortedByRate.slice(0, 3);
    
    const sumOfRates = selectedForAverage.reduce((sum, item) => sum + item.rate, 0);
    const average = sumOfRates / selectedForAverage.length;
    
    const finalRate = Math.ceil(average * 10000) / 10000;
    
    calculationResult = { top5, selectedRates: selectedForAverage, average, finalRate, sortedData };
}

// 결과 표시
function displayResults() {
    if(!calculationResult) return;
    document.getElementById('finalPredictedRate').textContent = `${calculationResult.finalRate.toFixed(4)}%`;
    document.getElementById('calculationDetails').innerHTML = `
        <div class="calculation-step">
            <h4><i class="fas fa-trophy mr-2 text-yellow-500"></i>1. 최다 선택 번호 (상위 5개)</h4>
            <p>${calculationResult.top5.map(item => `<strong>${item.number}번</strong> (${item.frequency}회, ${item.rate.toFixed(4)}%)`).join(', ')}</p>
        </div>
        <div class="calculation-step">
            <h4><i class="fas fa-filter mr-2 text-blue-500"></i>2. 산술평균 대상 요율 (상위 5개 중 높은 요율 3개)</h4>
            ${calculationResult.selectedRates.map(item => `<p>• <strong>${item.number}번</strong> 요율: <code>${item.rate.toFixed(4)}%</code></p>`).join('')}
        </div>
        <div class="calculation-step">
            <h4><i class="fas fa-calculator mr-2 text-green-500"></i>3. 산술평균 계산</h4>
            <p>(${calculationResult.selectedRates.map(item => item.rate.toFixed(4)).join(' + ')}) ÷ 3 = <code>${calculationResult.average.toFixed(8)}%</code></p>
        </div>
        <div class="calculation-step" style="background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%); border-left-color: #1d4ed8;">
            <h4><i class="fas fa-check-circle mr-2 text-blue-700"></i>4. 최종 결과 (소수점 넷째 자리 올림)</h4>
            <p class="text-xl font-bold text-blue-700">${calculationResult.finalRate.toFixed(4)}%</p>
        </div>`;
}

// 차트 생성
function createCharts() {
    if (frequencyChart) frequencyChart.destroy();
    if (rateVsFrequencyChart) rateVsFrequencyChart.destroy();
    
    const chartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    const ctx1 = document.getElementById('frequencyChart').getContext('2d');
    frequencyChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: Array.from({length: 15}, (_, i) => `${i + 1}번`),
            datasets: [{
                label: '선택 횟수', data: frequencyData,
                backgroundColor: Array.from({length: 15}, (_, i) => calculationResult.top5.some(item => item.number === i + 1) ? 'rgba(59, 130, 246, 0.8)' : 'rgba(156, 163, 175, 0.6)'),
                borderColor: Array.from({length: 15}, (_, i) => calculationResult.top5.some(item => item.number === i + 1) ? 'rgba(59, 130, 246, 1)' : 'rgba(156, 163, 175, 1)'),
                borderWidth: 1
            }]
        },
        options: { ...chartOptions, scales: { y: { beginAtZero: true, title: { display: true, text: '선택 횟수' } } } }
    });
    
    const ctx2 = document.getElementById('rateVsFrequencyChart').getContext('2d');
    const scatterData = ratesData.map((rate, index) => ({ x: rate, y: frequencyData[index], number: index + 1 }));
    rateVsFrequencyChart = new Chart(ctx2, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '요율 vs 선택 횟수', data: scatterData,
                backgroundColor: scatterData.map(d => calculationResult.selectedRates.some(item => item.number === d.number) ? 'rgba(16, 185, 129, 1)' : 'rgba(59, 130, 246, 0.8)'),
                pointRadius: 6, pointHoverRadius: 8
            }]
        },
        options: { ...chartOptions,
            plugins: { ...chartOptions.plugins, tooltip: { callbacks: { label: (c) => ` ${c.raw.number}번: ${c.raw.x.toFixed(4)}%, ${c.raw.y}회` } } },
            scales: { x: { title: { display: true, text: '복수예비임대요율 (%)' } }, y: { beginAtZero: true, title: { display: true, text: '선택 횟수' } } }
        }
    });
}

// 시나리오 저장
function saveCurrentScenario() {
    const name = document.getElementById('scenarioName').value.trim();
    if (!name) { alert('시나리오 이름을 입력해주세요.'); return; }
    
    const scenario = { id: Date.now(), name, date: new Date().toLocaleString('ko-KR'), rates: [...ratesData], frequencies: [...frequencyData], result: calculationResult.finalRate, expectedBidders: document.getElementById('expectedBidders').value, selectionsPerBidder: document.getElementById('selectionsPerBidder').value };
    
    savedScenarios.unshift(scenario);
    localStorage.setItem('savedScenarios', JSON.stringify(savedScenarios));
    displaySavedScenarios();
    document.getElementById('scenarioName').value = '';

    const button = document.getElementById('saveScenario');
    button.innerHTML = '<i class="fas fa-check mr-2"></i>저장 완료!';
    button.classList.add('bg-green-600', 'success-animation');
    setTimeout(() => {
        button.innerHTML = '<i class="fas fa-save mr-2"></i>현재 시나리오 저장';
        button.classList.remove('bg-green-600', 'success-animation');
    }, 2000);
}

// 저장된 시나리오 표시
function displaySavedScenarios() {
    const container = document.getElementById('savedScenarios');
    if (savedScenarios.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">저장된 시나리오가 없습니다.</p>';
        return;
    }
    container.innerHTML = savedScenarios.map(s => `
        <div class="scenario-card flex justify-between items-center">
            <div>
                <h4 class="font-bold text-gray-800">${s.name}</h4>
                <p class="text-sm text-gray-600">${s.date} | 예측결과: ${s.result.toFixed(4)}%</p>
            </div>
            <div class="flex gap-2">
                <button onclick="loadScenario(${s.id})" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm transition-all"><i class="fas fa-upload mr-1"></i>불러오기</button>
                <button onclick="deleteScenario(${s.id})" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-all"><i class="fas fa-trash mr-1"></i>삭제</button>
            </div>
        </div>`).join('');
}

// 시나리오 불러오기
function loadScenario(id) {
    const scenario = savedScenarios.find(s => s.id === id);
    if (!scenario) return;
    
    ratesData = [...scenario.rates];
    frequencyData = [...scenario.frequencies];
    
    createRateInputFields(); // 입력 필드를 다시 그리고
    ratesData.forEach((rate, index) => { // 값을 채웁니다.
        const input = document.getElementById(`rate${index + 1}`);
        if (input && rate !== null) {
            input.value = rate;
            input.closest('.rate-input-group').classList.add('filled');
        }
    });
    
    document.getElementById('expectedBidders').value = scenario.expectedBidders;
    document.getElementById('selectionsPerBidder').value = scenario.selectionsPerBidder;
    updateTotalExpected();
    showStep(1);
    alert(`'${scenario.name}' 시나리오를 불러왔습니다. '다음 단계'를 눌러 빈도 데이터를 확인하세요.`);
}

// 시나리오 삭제
function deleteScenario(id) {
    if (!confirm('이 시나리오를 삭제하시겠습니까?')) return;
    savedScenarios = savedScenarios.filter(s => s.id !== id);
    localStorage.setItem('savedScenarios', JSON.stringify(savedScenarios));
    displaySavedScenarios();
}

// localStorage에서 시나리오 불러오기
function loadSavedScenarios() {
    const stored = localStorage.getItem('savedScenarios');
    if (stored) {
        savedScenarios = JSON.parse(stored);
        displaySavedScenarios();
    }
}

// 단계 전환
function showStep(step) {
    document.querySelectorAll('.step-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(`step${step}`).classList.remove('hidden');
    updateProgress(step);
    currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Progress 인디케이터 업데이트
function updateProgress(step) {
    for (let i = 1; i <= 3; i++) {
        const circle = document.getElementById(`step${i}Circle`);
        const text = circle.nextElementSibling;
        
        circle.classList.toggle('active', i === step);
        circle.classList.toggle('bg-blue-600', i <= step);
        circle.classList.toggle('text-white', i <= step);
        circle.classList.toggle('bg-gray-300', i > step);
        circle.classList.toggle('text-gray-600', i > step);

        if(text) {
            text.classList.toggle('text-gray-800', i <= step);
            text.classList.toggle('text-gray-600', i > step);
        }
    }
    document.getElementById('progress1to2').style.width = step > 1 ? '100%' : '0%';
    document.getElementById('progress2to3').style.width = step > 2 ? '100%' : '0%';
}

function goToStep1() { showStep(1); }
function goToStep2FromStep3() { showStep(2); }

// 새로운 계산 시작
function startNewCalculation() {
    if(!confirm("정말로 모든 데이터를 초기화하고 새로 시작하시겠습니까?")) return;
    ratesData.fill(null);
    frequencyData.fill(0);
    calculationResult = null;
    
    createRateInputFields(); // 입력 필드 초기화
    document.getElementById('expectedBidders').value = 100;
    document.getElementById('selectionsPerBidder').value = 2;
    updateTotalExpected();
    showStep(1);
}

function showHelpModal() { document.getElementById('helpModal').classList.remove('hidden'); }
function hideHelpModal() { document.getElementById('helpModal').classList.add('hidden'); }

window.loadScenario = loadScenario;
window.deleteScenario = deleteScenario;
