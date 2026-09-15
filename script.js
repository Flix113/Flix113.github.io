// ==========================================
// CONFIGURARE API & FORMULARE
// ==========================================
const GROQ_API_KEY = "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"; 
const FORMSPREE_FORM_ID = "xqpkrglg";

// Ordine optimizată strict pe modelele disponibile în contul tău
const MODELS = [
  "openai/gpt-oss-120b", // Principala opțiune (cea mai deșteaptă)
  "qwen/qwen3.8-27b",    // Prima rezervă (foarte bun pe JSON și logică)
  "openai/gpt-oss-20b"   // A doua rezervă (viteză maximă)
];

// Starea aplicației
let currentUser = localStorage.getItem('user_name') || '';
let currentQuiz = null;
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let testHistory = JSON.parse(localStorage.getItem('quiz_history')) || [];

// ==========================================
// BAZĂ DE CUNOȘTINȚE (FEW-SHOT EXAMPLES)
// ==========================================
const KNOWLEDGE_BASE = {
    romanian: `
EXEMPLE ETALON (Acuratețe 100%):
1. Întrebare: În propoziția "A ajuns ce se temea că va ajunge", ce funcție sintactică are subordonata?
   Opțiuni: ["A) Subiectivă", "B) Nume predicativ", "C) Completivă directă", "D) Predicativă"]
   Corect: 3 (D - Predicativă)
   Explicație: Verbul "a ajuns" este copulativ și are nevoie de un nume predicativ, rol preluat de întreaga propoziție subordonată predicativă.

2. Întrebare: Care este forma corectă de plural conform DOOM3?
   Opțiuni: ["A) Niveluri / Nivele", "B) Vișine", "C) Plaje / Plăji", "D) Managere"]
   Corect: 0 (A)
   Explicație: Conform DOOM3, pentru termenul "nivel" sunt acceptate ambele forme de plural în funcție de sens.`,

    history: `
EXEMPLE ETALON (Acuratețe 100%):
1. Întrebare: În ce an a fost promulgată Constituția prin care s-a introdus votul universal pentru bărbați în România?
   Opțiuni: ["A) 1866", "B) 1923", "C) 1938", "D) 1965"]
   Corect: 1 (B - 1923)
   Explicație: Constituția din 1923 a consacrat votul universal, egal, direct, secret și obligatoriu pentru bărbații de peste 21 de ani.`,

    english: `
EXEMPLE ETALON (Acuratețe 100%):
1. Întrebare: Completează spațiul liber: "Hardly ______ the station when the train left."
   Opțiuni: ["A) I had reached", "B) had I reached", "C) reached I", "D) I reached"]
   Corect: 1 (B)
   Explicație: Propozițiile care încep cu adverbe negative/restrictive precum "Hardly" necesită inversiunea subiectului cu verbul auxiliar (Inversion).`,

    psych: `
EXEMPLE ETALON (Acuratețe 100%):
1. Întrebare: Care este numărul ce urmează în seria: 2, 5, 10, 17, 26, ?
   Opțiuni: ["A) 35", "B) 37", "C) 36", "D) 40"]
   Corect: 1 (B - 37)
   Explicație: Diferențele dintre numere cresc cu 2 la fiecare pas (+3, +5, +7, +9, deci urmează +11. 26 + 11 = 37).`
};

// ==========================================
// GESTIONARE TEMA & UTILIZATOR
// ==========================================
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    document.querySelector('.theme-toggle').textContent = newTheme === 'dark' ? '🌙' : '☀️';
    localStorage.setItem('theme_preference', newTheme);
}

window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme_preference') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggleBtn = document.querySelector('.theme-toggle');
    if(toggleBtn) toggleBtn.textContent = savedTheme === 'dark' ? '🌙' : '☀️';

    if (!currentUser) {
        openNameModal();
    } else {
        const nameEl = document.getElementById('displayName');
        if(nameEl) nameEl.textContent = currentUser;
        const modal = document.getElementById('nameModal');
        if(modal) modal.classList.add('hidden');
    }
});

function openNameModal() {
    document.getElementById('nameModal').classList.remove('hidden');
}

function saveUserName(e) {
    e.preventDefault();
    const name = document.getElementById('userNameInput').value.trim();
    if (name) {
        currentUser = name;
        localStorage.setItem('user_name', name);
        const nameEl = document.getElementById('displayName');
        if(nameEl) nameEl.textContent = name;
        document.getElementById('nameModal').classList.add('hidden');
    }
}

function switchTab(tab) {
    const tabCreate = document.getElementById('tabCreate');
    const tabHistory = document.getElementById('tabHistory');
    
    const viewCreate = document.getElementById('viewCreate');
    const viewQuiz = document.getElementById('viewQuiz');
    const viewHistory = document.getElementById('viewHistory');

    [tabCreate, tabHistory].forEach(t => t && t.classList.remove('active'));
    [viewCreate, viewQuiz, viewHistory].forEach(v => v && v.classList.add('hidden'));

    if (tab === 'create') {
        if(tabCreate) tabCreate.classList.add('active');
        if(viewCreate) viewCreate.classList.remove('hidden');
    } else if (tab === 'history') {
        if(tabHistory) tabHistory.classList.add('active');
        if(viewHistory) viewHistory.classList.remove('hidden');
        renderHistory();
    } else if (tab === 'quiz') {
        if(viewQuiz) viewQuiz.classList.remove('hidden');
    }
}

// ==========================================
// GENERARE TEST PRIN GROQ API (FALLBACK PE LISTA DE MODELE)
// ==========================================
async function generateQuiz(type) {
    let countInput = document.getElementById('questionCountInput').value;
    let count = parseInt(countInput) || 5;
    if (count < 1) count = 1;
    if (count > 25) count = 25;

    let instructions = "";
    let baseContext = "";

    if (type === 'psych') {
        instructions = `Creează un test psihologic format EXCLUSIV și STRICT din SERII NUMERICE pentru admitere Poliție. Fiecare întrebare trebuie să ceară identificarea numărului ce urmează. Explicația trebuie să detalieze regula pas cu pas.`;
        baseContext = KNOWLEDGE_BASE.psych;
    } else if (type === 'police_romanian') {
        instructions = `Creează un test grilă de Limba Română (gramatică avansată, sintaxă, DOOM3) la nivelul Academiei de Poliție. Pune capcane de redactare la opțiunile greșite.`;
        baseContext = KNOWLEDGE_BASE.romanian;
    } else if (type === 'police_history') {
        instructions = `Creează un test grilă de Istoria Românilor la nivelul Academiei de Poliție. Axează-te pe cronologie fină, tratate și constituții din sec XVIII-XX.`;
        baseContext = KNOWLEDGE_BASE.history;
    } else if (type === 'police_english') {
        instructions = `Creează un test grilă de Limba Engleză avansată (C1/C2 - Inversion, Conditionals, Subjunctive, Phrasal Verbs) pentru admitere Poliție. Explicația trebuie furnizată în limba română.`;
        baseContext = KNOWLEDGE_BASE.english;
    } else if (type === 'general') {
        const topic = document.getElementById('topicInput').value.trim();
        if (!topic) { alert('Te rugăm să introduci un subiect!'); return; }
        instructions = `Creează un test grilă pe tema "${topic}".`;
    }

    const aiOverlay = document.getElementById('aiLoadingOverlay');
    aiOverlay.classList.remove('hidden');

    const fullPrompt = `Ești un profesor universitar expert în grilajele de admitere.
Sarcina ta: Generează exact ${count} întrebări la nivel avansat.

${baseContext ? "Baza de cunoștințe și modele de referință:\n" + baseContext : ""}

Cerințe stricte:
1. Fiecare întrebare trebuie să aibă 4 opțiuni de răspuns.
2. Câmpul 'correct' reprezintă indexul de la 0 la 3 al răspunsului corect.
3. Cerințe specifice: ${instructions}

Răspunde STRICT cu un obiect JSON valid în limba română (fără text adițional Markdown):
{
  "title": "Test Grilă - Nivel Admitere",
  "questions": [
    {
      "q": "Formularea întrebării",
      "opts": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": 0,
      "explanation": "Explicație clară și detaliată"
    }
  ]
}`;

    const loaderStart = performance.now();
    const loaderSteps = document.querySelectorAll('.loading-step');
    let loaderStepIndex = 0;
    const loaderInterval = setInterval(() => {
        loaderSteps.forEach((step, i) => step.classList.toggle('active', i === loaderStepIndex));
        loaderStepIndex = (loaderStepIndex + 1) % loaderSteps.length;
    }, 900);

    let generatedContent = null;
    let lastError = null;

    // Încearcă fiecare model din lista MODELS până când unul răspunde cu succes
    for (const modelName of MODELS) {
        try {
            console.log(`Se încearcă generarea cu modelul: ${modelName}`);
            const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: modelName,
                    response_format: { type: "json_object" },
                    messages: [{ role: "user", content: fullPrompt }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                generatedContent = data.choices[0].message.content;
                console.log(`Succes folosind modelul: ${modelName}`);
                break;
            } else {
                const errData = await response.json();
                lastError = errData.error?.message || `Eroare HTTP ${response.status}`;
                console.warn(`Modelul ${modelName} a eșuat. Se trece la următorul...`, lastError);
            }
        } catch (err) {
            lastError = err.message;
            console.warn(`Eroare de rețea cu modelul ${modelName}:`, err);
        }
    }

    try {
        if (!generatedContent) {
            throw new Error(lastError || "Toate modelele din listă au eșuat.");
        }

        currentQuiz = JSON.parse(generatedContent);
        startQuiz();
    } catch (err) {
        console.error(err);
        alert("Eroare la generarea testului: " + err.message);
    } finally {
        clearInterval(loaderInterval);
        const elapsed = performance.now() - loaderStart;
        const minimumDisplay = 2000;
        if (elapsed < minimumDisplay) {
            await new Promise(resolve => setTimeout(resolve, minimumDisplay - elapsed));
        }
        aiOverlay.classList.add('hidden');
    }
}

// ==========================================
// RULARE & INTERACȚIUNE TEST
// ==========================================
function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];

    document.getElementById('quizTitle').textContent = currentQuiz.title;
    document.getElementById('summaryContainer').classList.add('hidden');
    document.getElementById('questionContainer').classList.remove('hidden');

    switchTab('quiz');
    showQuestion();
}

function showQuestion() {
    const q = currentQuiz.questions[currentQuestionIndex];
    const total = currentQuiz.questions.length;
    
    document.getElementById('quizProgress').textContent = `${currentQuestionIndex + 1} / ${total}`;
    document.getElementById('progressBar').style.width = `${((currentQuestionIndex + 1) / total) * 100}%`;
    document.getElementById('questionText').textContent = q.q;

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    document.getElementById('explanationBox').classList.add('hidden');
    document.getElementById('quizFooter').classList.add('hidden');

    q.opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `<span>${opt}</span>`;
        btn.onclick = () => selectOption(idx, btn);
        optionsContainer.appendChild(btn);
    });
}

function selectOption(selectedIndex, selectedBtn) {
    const q = currentQuiz.questions[currentQuestionIndex];
    const allBtns = document.querySelectorAll('.option-btn');
    
    allBtns.forEach(btn => btn.disabled = true);

    const isCorrect = selectedIndex === q.correct;
    if (isCorrect) {
        selectedBtn.classList.add('correct');
        score++;
    } else {
        selectedBtn.classList.add('wrong');
        if (allBtns[q.correct]) {
            allBtns[q.correct].classList.add('correct');
        }
    }

    userAnswers.push({
        question: q.q,
        userChoice: q.opts[selectedIndex],
        correctChoice: q.opts[q.correct],
        isCorrect: isCorrect
    });

    const expBox = document.getElementById('explanationBox');
    expBox.innerHTML = "<strong>💡 Explicație:</strong> " + q.explanation;
    expBox.classList.remove('hidden');

    document.getElementById('quizFooter').classList.remove('hidden');
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuiz.questions.length) {
        showQuestion();
    } else {
        finishQuiz();
    }
}

// ==========================================
// FINALIZARE TEST & TRIMITERE EMAIL
// ==========================================
async function finishQuiz() {
    document.getElementById('questionContainer').classList.add('hidden');
    document.getElementById('quizFooter').classList.add('hidden');
    document.getElementById('summaryContainer').classList.remove('hidden');

    const total = currentQuiz.questions.length;
    const scoreText = `${score} / ${total}`;
    const percentage = Math.round((score / total) * 100);
    
    document.getElementById('finalScore').textContent = `${scoreText} (${percentage}%)`;

    const historyItem = {
        title: currentQuiz.title,
        date: new Date().toLocaleDateString('ro-RO') + ' ' + new Date().toLocaleTimeString('ro-RO', {hour: '2-digit', minute:'2-digit'}),
        score: scoreText,
        percentage: percentage
    };
    testHistory.unshift(historyItem);
    localStorage.setItem('quiz_history', JSON.stringify(testHistory));

    sendResultsToFormspree(scoreText);
}

function renderHistory() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;

    if (testHistory.length === 0) {
        container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 20px;">Nu ai efectuat niciun test până acum.</p>`;
        return;
    }

    container.innerHTML = testHistory.map(item => {
        let badgeClass = 'score-high';
        if (item.percentage < 50) badgeClass = 'score-low';
        else if (item.percentage < 80) badgeClass = 'score-mid';

        return `
            <div class="history-card">
                <div class="history-info">
                    <h4>${item.title}</h4>
                    <p>📅 ${item.date}</p>
                </div>
                <div class="score-badge ${badgeClass}">
                    ${item.score} (${item.percentage}%)
                </div>
            </div>
        `;
    }).join('');
}

function clearHistory() {
    if (confirm("Sigur dorești să ștergi tot istoricul testelor?")) {
        testHistory = [];
        localStorage.removeItem('quiz_history');
        renderHistory();
    }
}

async function sendResultsToFormspree(scoreText) {
    const statusEl = document.getElementById('emailStatus');
    if (statusEl) statusEl.textContent = "Se trimit rezultatele pe email...";

    const wrongAnswers = userAnswers.filter(ans => !ans.isCorrect);
    let wrongQuestionsFormatted = "";

    if (wrongAnswers.length === 0) {
        wrongQuestionsFormatted = "Felicitări! Toate răspunsurile au fost corecte. 🚀";
    } else {
        wrongQuestionsFormatted = wrongAnswers.map((ans, index) => {
            return `${index + 1}. Întrebare: ${ans.question}\n   ❌ Răspuns ales: ${ans.userChoice}\n   ✅ Răspuns corect: ${ans.correctChoice}\n`;
        }).join('\n');
    }

    try {
        const response = await fetch(`https://formspree.io/f/${FORMSPREE_FORM_ID}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                NumeUtilizator: currentUser,
                TitluTest: currentQuiz.title,
                Scor: scoreText,
                NumarGreseli: wrongAnswers.length,
                DetaliiGreseli: wrongQuestionsFormatted,
                Data: new Date().toLocaleString('ro-RO')
            })
        });

        if (response.ok) {
            if (statusEl) statusEl.textContent = "✅ Rezultatele și greșelile au fost trimise pe email!";
        } else {
            if (statusEl) statusEl.textContent = "❌ Notificarea prin email nu a putut fi trimisă.";
        }
    } catch (err) {
        if (statusEl) statusEl.textContent = "❌ Eroare de conexiune la trimitere.";
    }
}
