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
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    // 요율 입력 필드 생성
    createRateInputFields();
    
    // 이벤트 리스너 설정
    setupEventListeners();
    
    // localStorage에서 저장된 시나리오 불러오기
    loadSavedScenarios();
}

// 요율 입력 필드 동적 생성
function createRateInputFields() {
    const groups = document.querySelectorAll('.rate-input-group');
    
    groups.forEach((group, index) => {
        const num = index + 1;
        group.innerHTML = `
            <label for="rate${num}">${num}번</label>
            <div class="flex items-center flex-1">
                <input type="number" 
                       id="rate${num}" 
                       class="rate-input flex-1" 
                       placeholder="0.0000" 
                       step="0.0001" 
                       min="0" 
                       max="100"
                       data-index="${index}">
                <span class="ml-2 text-gray-600">%</span>
            </div>
        `;
    });
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
    document.getElementById('prevStep3').addEventListener('click', goToStep2);
    document.getElementById('newCalculation').addEventListener('click', startNewCalculation);
    document.getElementById('saveScenario').addEventListener('click', saveCurrentScenario);
    
    // 도움말 모달
    document.getElementById('helpBtn').addEventListener('click', showHelpModal);
    document.getElementById('closeHelp').addEventListener('click', hideHelpModal);
    
    // 요율 입력 필드 이벤트
    document.querySelectorAll('.rate-input').forEach(input => {
        input.addEventListener('input', function() {
            const index = parseInt(this.dataset.index);
            ratesData[index] = parseFloat(this.value) || null;
            
            // 입력된 필드 스타일 변경
            if (this.value) {
                this.closest('.rate-input-group').classList.add('filled');
            } else {
                this.closest('.rate-input-group').classList.remove('filled');
            }
        });
    });
    
    // 모달 외부 클릭 시 닫기
    document.getElementById('helpModal').addEventListener('click', function(e) {
        if (e.target === this) {
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
        input.value = rate;
        ratesData[index] = rate;
        input.closest('.rate-input-group').classList.add('filled');
    });
    
    // 성공 애니메이션
    document.querySelectorAll('.rate-input-group').forEach(group => {
        group.classList.add('success-animation');
        setTimeout(() => group.classList.remove('success-animation'), 500);
    });
}

// Step 1 -> Step 2
function goToStep2() {
    // 입력 검증
    const filledCount = ratesData.filter(rate => rate !== null).length;
    
    if (filledCount < 15) {
        alert(`모든 복수예비임대요율을 입력해주세요.\n현재 ${filledCount}/15개 입력됨`);
        
        // 빈 필드에 에러 표시
        document.querySelectorAll('.rate-input').forEach((input, index) => {
            if (!input.value) {
                input.classList.add('error-shake');
                setTimeout(() => input.classList.remove('error-shake'), 500);
            }
        });
        return;
    }
    
    // 빈도 테이블 생성
    createFrequencyTable();
    
    // 단계 전환
    showStep(2);
}

// 빈도 테이블 생성
function createFrequencyTable() {
    const tbody = document.getElementById('frequencyTableBody');
    tbody.innerHTML = '';
    
    ratesData.forEach((rate, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="border border-gray-300 px-4 py-2 font-medium">${index + 1}번</td>
            <td class="border border-gray-300 px-4 py-2">${rate.toFixed(4)}%</td>
            <td class="border border-gray-300 px-4 py-2">
                <input type="number" 
                       class="frequency-input" 
                       id="freq${index + 1}"
                       data-index="${index}"
                       min="0" 
                       step="1"
                       value="${frequencyData[index] || 0}">
            </td>
            <td class="border border-gray-300 px-4 py-2 percentage-cell">0%</td>
        `;
        tbody.appendChild(row);
    });
    
    // 빈도 입력 이벤트 리스너
    document.querySelectorAll('.frequency-input').forEach(input => {
        input.addEventListener('input', updateFrequencyCalculations);
    });
}

// 빈도 계산 업데이트
function updateFrequencyCalculations() {
    let total = 0;
    const expectedTotal = parseInt(document.getElementById('expectedBidders').value) * 
                         parseInt(document.getElementById('selectionsPerBidder').value);
    
    document.querySelectorAll('.frequency-input').forEach((input, index) => {
        const value = parseInt(input.value) || 0;
        frequencyData[index] = value;
        total += value;
    });
    
    // 합계 및 비율 업데이트
    document.getElementById('totalFrequency').textContent = `${total}회`;
    
    // 각 행의 비율 업데이트
    document.querySelectorAll('.percentage-cell').forEach((cell, index) => {
        const percentage = total > 0 ? (frequencyData[index] / total * 100).toFixed(1) : 0;
        cell.textContent = `${percentage}%`;
    });
    
    // 전체 비율
    const totalPercentage = total > 0 ? (total / expectedTotal * 100).toFixed(1) : 0;
    document.getElementById('totalPercentage').textContent = `${totalPercentage}%`;
    
    // 경고 표시
    if (Math.abs(total - expectedTotal) > 5) {
        document.getElementById('totalFrequency').style.color = '#ef4444';
        document.getElementById('totalPercentage').style.color = '#ef4444';
    } else {
        document.getElementById('totalFrequency').style.color = '#059669';
        document.getElementById('totalPercentage').style.color = '#059669';
    }
}

// 총 예상 선택 횟수 업데이트
function updateTotalExpected() {
    const bidders = parseInt(document.getElementById('expectedBidders').value) || 0;
    const selections = parseInt(document.getElementById('selectionsPerBidder').value) || 0;
    document.getElementById('totalExpectedSelections').textContent = `${bidders * selections}회`;
}

// 자동 분배
function autoDistributeFrequency() {
    const bidders = parseInt(document.getElementById('expectedBidders').value) || 100;
    const selections = parseInt(document.getElementById('selectionsPerBidder').value) || 2;
    const total = bidders * selections;
    
    // 정규분포 시뮬레이션 (중간 값들이 더 많이 선택되도록)
    const mean = 7; // 중간값 (0-14 인덱스 기준)
    const stdDev = 3;
    
    let distributedTotal = 0;
    const distribution = [];
    
    for (let i = 0; i < 15; i++) {
        // 정규분포 확률 계산
        const probability = Math.exp(-0.5 * Math.pow((i - mean) / stdDev, 2));
        distribution.push(probability);
    }
    
    // 정규화
    const sum = distribution.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < 15; i++) {
        const value = Math.round((distribution[i] / sum) * total);
        frequencyData[i] = value;
        distributedTotal += value;
        
        const input = document.getElementById(`freq${i + 1}`);
        if (input) input.value = value;
    }
    
    // 차이 보정 (반올림으로 인한 오차 조정)
    if (distributedTotal !== total) {
        const diff = total - distributedTotal;
        frequencyData[7] += diff; // 중간값에 차이 추가
        document.getElementById('freq8').value = frequencyData[7];
    }
    
    updateFrequencyCalculations();
}

// Step 2 -> Step 3 (계산 실행)
function goToStep3() {
    const total = frequencyData.reduce((sum, freq) => sum + freq, 0);
    
    if (total === 0) {
        alert('예상 선택 횟수를 입력해주세요.');
        return;
    }
    
    // 계산 수행
    performCalculation();
    
    // 결과 표시
    displayResults();
    
    // 차트 생성
    createCharts();
    
    // 단계 전환
    showStep(3);
}

// 예정임대요율 계산
function performCalculation() {
    // 빈도 기준 정렬 (내림차순)
    const sortedData = ratesData.map((rate, index) => ({
        number: index + 1,
        rate: rate,
        frequency: frequencyData[index]
    })).sort((a, b) => b.frequency - a.frequency);
    
    // 상위 5개 선택
    const top5 = sortedData.slice(0, 5);
    
    // 상위 5개 중 낮은 요율 3개 선택
    const top5Sorted = [...top5].sort((a, b) => a.rate - b.rate);
    const selectedRates = top5Sorted.slice(0, 3);
    
    // 산술평균 계산
    const average = selectedRates.reduce((sum, item) => sum + item.rate, 0) / 3;
    
    // 소수점 넷째 자리에서 올림
    const finalRate = Math.ceil(average * 10000) / 10000;
    
    calculationResult = {
        top5: top5,
        selectedRates: selectedRates,
        average: average,
        finalRate: finalRate,
        sortedData: sortedData
    };
}

// 결과 표시
function displayResults() {
    // 최종 예측 결과
    document.getElementById('finalPredictedRate').textContent = 
        `${calculationResult.finalRate.toFixed(4)}%`;
    
    // 상세 계산 과정
    const detailsDiv = document.getElementById('calculationDetails');
    
    detailsDiv.innerHTML = `
        <div class="calculation-step">
            <h4><i class="fas fa-trophy mr-2"></i>1. 최다 선택 번호 (상위 5개)</h4>
            <p>${calculationResult.top5.map(item => 
                `<strong>${item.number}번</strong> (${item.frequency}회)`
            ).join(', ')}</p>
        </div>
        
        <div class="calculation-step">
            <h4><i class="fas fa-filter mr-2"></i>2. 산술평균 대상 요율 (상위 5개 중 낮은 3개)</h4>
            ${calculationResult.selectedRates.map(item => 
                `<p>• ${item.number}번 요율: <code>${item.rate.toFixed(4)}%</code></p>`
            ).join('')}
        </div>
        
        <div class="calculation-step">
            <h4><i class="fas fa-calculator mr-2"></i>3. 산술평균 계산</h4>
            <p>
                (${calculationResult.selectedRates.map(item => item.rate.toFixed(4)).join(' + ')}) ÷ 3 
                = <code>${calculationResult.average.toFixed(8)}%</code>
            </p>
        </div>
        
        <div class="calculation-step" style="background: linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%); border-left-color: #1d4ed8;">
            <h4><i class="fas fa-check-circle mr-2"></i>4. 최종 결과 (소수점 넷째 자리 올림)</h4>
            <p class="text-lg font-bold text-blue-700">
                ${calculationResult.finalRate.toFixed(4)}%
            </p>
        </div>
    `;
}

// 차트 생성
function createCharts() {
    // 기존 차트 제거
    if (frequencyChart) frequencyChart.destroy();
    if (rateVsFrequencyChart) rateVsFrequencyChart.destroy();
    
    // 빈도 분포 차트
    const ctx1 = document.getElementById('frequencyChart').getContext('2d');
    frequencyChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: Array.from({length: 15}, (_, i) => `${i + 1}번`),
            datasets: [{
                label: '선택 횟수',
                data: frequencyData,
                backgroundColor: frequencyData.map((_, index) => {
                    // 상위 5개 강조
                    const isTop5 = calculationResult.top5.some(item => item.number === index + 1);
                    return isTop5 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(156, 163, 175, 0.6)';
                }),
                borderColor: frequencyData.map((_, index) => {
                    const isTop5 = calculationResult.top5.some(item => item.number === index + 1);
                    return isTop5 ? 'rgba(59, 130, 246, 1)' : 'rgba(156, 163, 175, 1)';
                }),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const total = frequencyData.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed.y / total) * 100).toFixed(1);
                            return `비율: ${percentage}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '선택 횟수'
                    }
                }
            }
        }
    });
    
    // 요율 vs 선택 횟수 산점도
    const ctx2 = document.getElementById('rateVsFrequencyChart').getContext('2d');
    const scatterData = ratesData.map((rate, index) => ({
        x: rate,
        y: frequencyData[index],
        label: `${index + 1}번`
    }));
    
    rateVsFrequencyChart = new Chart(ctx2, {
        type: 'scatter',
        data: {
            datasets: [{
                label: '요율 vs 선택 횟수',
                data: scatterData,
                backgroundColor: scatterData.map((_, index) => {
                    const isSelected = calculationResult.selectedRates.some(item => item.number === index + 1);
                    return isSelected ? 'rgba(16, 185, 129, 0.8)' : 'rgba(59, 130, 246, 0.6)';
                }),
                borderColor: scatterData.map((_, index) => {
                    const isSelected = calculationResult.selectedRates.some(item => item.number === index + 1);
                    return isSelected ? 'rgba(16, 185, 129, 1)' : 'rgba(59, 130, 246, 1)';
                }),
                borderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const point = scatterData[context.dataIndex];
                            return `${point.label}: ${point.x.toFixed(4)}%, ${point.y}회`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '복수예비임대요율 (%)'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '선택 횟수'
                    }
                }
            }
        }
    });
}

// 시나리오 저장
function saveCurrentScenario() {
    const name = document.getElementById('scenarioName').value.trim();
    
    if (!name) {
        alert('시나리오 이름을 입력해주세요.');
        document.getElementById('scenarioName').focus();
        return;
    }
    
    const scenario = {
        id: Date.now(),
        name: name,
        date: new Date().toLocaleString('ko-KR'),
        rates: [...ratesData],
        frequencies: [...frequencyData],
        result: calculationResult.finalRate,
        expectedBidders: document.getElementById('expectedBidders').value,
        selectionsPerBidder: document.getElementById('selectionsPerBidder').value
    };
    
    savedScenarios.push(scenario);
    localStorage.setItem('savedScenarios', JSON.stringify(savedScenarios));
    
    displaySavedScenarios();
    document.getElementById('scenarioName').value = '';
    
    // 저장 완료 애니메이션
    const button = document.getElementById('saveScenario');
    button.textContent = '저장 완료!';
    button.classList.add('bg-green-600');
    setTimeout(() => {
        button.innerHTML = '<i class="fas fa-save mr-2"></i>현재 시나리오 저장';
        button.classList.remove('bg-green-600');
    }, 2000);
}

// 저장된 시나리오 표시
function displaySavedScenarios() {
    const container = document.getElementById('savedScenarios');
    
    if (savedScenarios.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center py-4">저장된 시나리오가 없습니다.</p>';
        return;
    }
    
    container.innerHTML = savedScenarios.map(scenario => `
        <div class="scenario-card flex justify-between items-center">
            <div>
                <h4 class="font-bold text-gray-800">${scenario.name}</h4>
                <p class="text-sm text-gray-600">${scenario.date} | 예측결과: ${scenario.result.toFixed(4)}%</p>
            </div>
            <div class="flex gap-2">
                <button onclick="loadScenario(${scenario.id})" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                    <i class="fas fa-upload mr-1"></i>불러오기
                </button>
                <button onclick="deleteScenario(${scenario.id})" 
                        class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">
                    <i class="fas fa-trash mr-1"></i>삭제
                </button>
            </div>
        </div>
    `).join('');
}

// 시나리오 불러오기
function loadScenario(id) {
    const scenario = savedScenarios.find(s => s.id === id);
    if (!scenario) return;
    
    // 데이터 복원
    ratesData = [...scenario.rates];
    frequencyData = [...scenario.frequencies];
    
    // Step 1 필드 복원
    ratesData.forEach((rate, index) => {
        const input = document.getElementById(`rate${index + 1}`);
        if (input) {
            input.value = rate;
            input.closest('.rate-input-group').classList.add('filled');
        }
    });
    
    // Step 2 설정 복원
    document.getElementById('expectedBidders').value = scenario.expectedBidders;
    document.getElementById('selectionsPerBidder').value = scenario.selectionsPerBidder;
    updateTotalExpected();
    
    // Step 1로 이동
    showStep(1);
    
    alert(`'${scenario.name}' 시나리오를 불러왔습니다.`);
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
    }
}

// 단계 전환
function showStep(step) {
    // 모든 단계 숨기기
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.add('hidden');
    });
    
    // 선택된 단계 표시
    document.getElementById(`step${step}`).classList.remove('hidden');
    
    // Progress 업데이트
    updateProgress(step);
    
    currentStep = step;
    
    // 스크롤 상단으로
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Progress 인디케이터 업데이트
function updateProgress(step) {
    // 모든 서클 초기화
    for (let i = 1; i <= 3; i++) {
        const circle = document.getElementById(`step${i}Circle`);
        if (i <= step) {
            circle.classList.add('bg-blue-600', 'text-white');
            circle.classList.remove('bg-gray-300', 'text-gray-600');
        } else {
            circle.classList.remove('bg-blue-600', 'text-white');
            circle.classList.add('bg-gray-300', 'text-gray-600');
        }
        
        if (i === step) {
            circle.classList.add('active');
        } else {
            circle.classList.remove('active');
        }
    }
    
    // Progress 바 업데이트
    document.getElementById('progress1to2').style.width = step >= 2 ? '100%' : '0%';
    document.getElementById('progress2to3').style.width = step >= 3 ? '100%' : '0%';
}

// 이전/다음 단계 이동
function goToStep1() {
    showStep(1);
}

function goToStep2FromStep3() {
    showStep(2);
}

// 새로운 계산 시작
function startNewCalculation() {
    // 데이터 초기화
    ratesData = new Array(15).fill(null);
    frequencyData = new Array(15).fill(0);
    calculationResult = null;
    
    // 입력 필드 초기화
    document.querySelectorAll('.rate-input').forEach(input => {
        input.value = '';
        input.closest('.rate-input-group').classList.remove('filled');
    });
    
    // Step 1로 이동
    showStep(1);
}

// 도움말 모달 표시/숨기기
function showHelpModal() {
    document.getElementById('helpModal').classList.remove('hidden');
}

function hideHelpModal() {
    document.getElementById('helpModal').classList.add('hidden');
}

// 전역 함수로 내보내기 (HTML에서 직접 호출용)
window.loadScenario = loadScenario;
window.deleteScenario = deleteScenario;