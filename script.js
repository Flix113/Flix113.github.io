// ==========================================
// 1. KNOWLEDGE BASE (Baza de cunoștințe etalon)[cite: 1]
// ==========================================
const KNOWLEDGE_BASE = {
  romana: [
    {
      intrebare: "În fraza: 'E de mirare cum de a rezistat să stea până la această oră.', prima subordonată este:",
      optiuni: ["a) completivă directă", "b) subiectivă", "c) circumstanțială de mod", "d) predicativă"],
      raspuns_corect: "b",
      explicatie: "Regentul este expresia impersonală 'E de mirare', care cere o propoziție subiectivă ('cum de a rezistat')."
    },
    {
      intrebare: "Selectează varianta în care toate cuvintele conțin doar relații de paronimie:",
      optiuni: [
        "a) familial / familiar, eminent / iminent, literal / literar",
        "b) abilitate / agilitate, oral / orar, nervos / calm",
        "c) arbitral / arbitrar, emigrație / imigrație, vibra / răsuna",
        "d) apropiere / apropriere, barem / barem, deferență / diferență"
      ],
      raspuns_corect: "a",
      explicatie: "Toate perechile din opțiunea 'a' sunt paronime. În 'b' avem antonime (nervos/calm), iar în 'c' sinonime (vibra/răsuna)."
    }
  ],
  istorie: [
    {
      intrebare: "Analizați următoarele enunțuri:\n(1) Proiectul 'Constituției Cărvunarilor' promova principiul separării puterilor în stat.\n(2) Mișcarea condusă de Tudor Vladimirescu a impus restabilirea domniilor pământene.",
      optiuni: [
        "a) Ambele afirmații sunt adevărate și există relație de cauzalitate între ele.",
        "b) Ambele afirmații sunt adevărate, dar FĂRĂ relație de cauzalitate.",
        "c) Prima afirmație este adevărată, iar a doua este falsă.",
        "d) Prima afirmație este falsă, iar a doua este adevărată."
      ],
      raspuns_corect: "b",
      explicatie: "Ambele afirmații sunt fapte istorice reale și corecte, dar Proiectul Cărvunarilor (1822) nu este cauza directă a restabilirii domniilor pământene rezultate în urma mișcării din 1821."
    }
  ]
};

// ==========================================
// 2. CONSTRUCTORUL DE PROMPT FEW-SHOT[cite: 1]
// ==========================================
function buildFewShotPrompt(materia, capitol, numarIntrebari = 5) {
  // Preluăm exemplele specifice din Knowledge Base[cite: 1]
  const exemple = KNOWLEDGE_BASE[materia] || KNOWLEDGE_BASE.romana;
  
  const exempleFormatted = exemple.map((ex, idx) => `
Exemplul ${idx + 1}:
Întrebare: ${ex.intrebare}
Opțiuni:
${ex.optiuni.join("\n")}
Răspuns corect: ${ex.raspuns_corect}
Explicație: ${ex.explicatie}
`).join("\n---\n");

  return `Ești un profesor expert și membru în comisia de elaborare a subiectelor pentru examenul de admitere la Academia de Poliție „Alexandru Ioan Cuza”.

Misiunea ta este să generezi grile de nivel AVANSAT (dificultate maximă), cu capcane gramaticale sau istorice specifice rigori examenului de admitere.

STRUCTURĂ ȘI EXEMPLE ETALON DUPĂ CARE TREBUIE SĂ TE GHIDEZI STRICT:
${exempleFormatted}

INSTRUCTIUNI DE GENERARE:
1. Materia solicitată: "${materia.toUpperCase()}"
2. Capitolul/Tema: "${capitol}"
3. Generează EXACT ${numarIntrebari} grile noi, distincte de cele din exemple, dar identice ca stil, dificultate și capcane.
4. Răspunde EXCLUSIV în format JSON valid, fără text introductiv sau explicații în afara structurii JSON.

FORMATUL JSON OBLIGATORIU:
{
  "quiz": [
    {
      "id": 1,
      "intrebare": "Textul întrebării...",
      "optiuni": ["a) ...", "b) ...", "c) ...", "d) ..."],
      "raspuns_corect": "a",
      "explicatie": "Explicație detaliată și argumentată..."
    }
  ]
}`;
}

// ==========================================
// 3. APELUL API CU MODELELE DISPONIBILE[cite: 1]
// ==========================================
async function generatePoliceAcademyQuiz(materia, capitol, apiKey) {
  const fullPrompt = buildFewShotPrompt(materia, capitol);
  
  // Lista modelelor active din contul tău[cite: 1]
  const models = [
    "openai/gpt-oss-120b", // Prima opțiune: Cel mai inteligent model LLM (120B)[cite: 1]
    "qwen/qwen3.8-27b",    // A doua opțiune: Excelent pe formatare JSON și logică[cite: 1]
    "openai/gpt-oss-20b"   // A treia opțiune: Viteză maximă de rezervă[cite: 1]
  ];

  for (const model of models) {
    try {
      console.log(`[Groq API] Se încearcă generarea cu modelul: ${model}...`);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "Ești un generator automat de teste grilă în format JSON pentru Academia de Poliție."
            },
            {
              role: "user",
              content: fullPrompt
            }
          ],
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        console.warn(`[Groq API] Modelul ${model} a eșuat (Status: ${response.status}). Se încearcă următorul model...`, errData);
        continue;
      }

      const data = await response.json();
      const rawContent = data.choices[0].message.content;
      
      const parsedQuiz = JSON.parse(rawContent);
      
      console.log(`[Groq API] Test generat cu succes folosind modelul: ${model}`);
      return parsedQuiz.quiz;

    } catch (err) {
      console.error(`[Groq API] Eroare la procesarea cu modelul ${model}:`, err);
    }
  }

  throw new Error("Nu s-a putut genera testul. Toate modelele au depășit limita temporară sau cheia API este invalidă.");
}

// ==========================================
// 4. INTEGRATORUL PENTRU BUTONUL DIN UI
// ==========================================
async function handleGenerateButtonClick() {
  // Cheia ta API Groq inserată direct
  const GROQ_API_KEY = "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";
  
  // Preluăm valorile selectate de utilizator în HTML (sau valori implicite dacă lipsesc elementele)
  const materiaElement = document.getElementById('selectMateria');
  const capitolElement = document.getElementById('inputCapitol');
  
  const materia = materiaElement ? materiaElement.value : "romana";
  const capitol = capitolElement && capitolElement.value ? capitolElement.value : "Morfosintaxă - Excepții subordonate și acorduri";

  const btnGenerate = document.getElementById('btnGenerate');
  if (btnGenerate) btnGenerate.disabled = true;

  try {
    console.log("Se inițiază generarea testului...");
    
    const questions = await generatePoliceAcademyQuiz(materia, capitol, GROQ_API_KEY);
    
    // Randăm grilele pe ecran
    renderQuizOnUI(questions);

  } catch (error) {
    alert("Eroare la generare: " + error.message);
  } finally {
    if (btnGenerate) btnGenerate.disabled = false;
  }
}

// ==========================================
// 5. AFISAREA INTERACTIVĂ A GRILELOR
// ==========================================
function renderQuizOnUI(questions) {
  const container = document.getElementById('quizContainer');
  if (!container) {
    console.log("Grile generat cu succes:", questions);
    return;
  }

  container.innerHTML = ''; // Curățăm ecranul anterior

  questions.forEach((q, index) => {
    const card = document.createElement('div');
    card.className = 'card my-3 p-3 shadow-sm';
    
    let optionsHTML = '';
    q.optiuni.forEach((opt) => {
      // Preluăm litera opțiunii ('a', 'b', 'c', 'd')
      const letter = opt.trim().charAt(0).toLowerCase();
      
      optionsHTML += `
        <button class="btn btn-outline-primary text-start my-1 w-100 option-btn" 
                onclick="checkAnswer(this, '${letter}', '${q.raspuns_corect}', 'expl-${index}')">
          ${opt}
        </button>
      `;
    });

    card.innerHTML = `
      <h5><strong>${index + 1}.</strong> ${q.intrebare}</h5>
      <div class="options-group mt-2">
        ${optionsHTML}
      </div>
      <div id="expl-${index}" class="alert mt-3 d-none">
        <strong>Explicație:</strong> ${q.explicatie}
      </div>
    `;

    container.appendChild(card);
  });
}

// Funcție pentru verificarea instantanee a opțiunii apăsate
function checkAnswer(button, selected, correct, explId) {
  const parent = button.parentElement;
  const buttons = parent.querySelectorAll('.option-btn');
  const explDiv = document.getElementById(explId);

  // Dezactivăm toate butoanele acestei întrebări după selectare
  buttons.forEach(btn => btn.disabled = true);

  if (selected === correct) {
    button.classList.remove('btn-outline-primary');
    button.classList.add('btn-success');
    explDiv.classList.add('alert-success');
  } else {
    button.classList.remove('btn-outline-primary');
    button.classList.add('btn-danger');
    explDiv.classList.add('alert-warning');
    
    // Arătăm și opțiunea corectă
    buttons.forEach(btn => {
      const btnLetter = btn.innerText.trim().charAt(0).toLowerCase();
      if (btnLetter === correct) {
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-success');
      }
    });
  }

  // Afișăm explicația
  explDiv.classList.remove('d-none');
}
