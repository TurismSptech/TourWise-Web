(function () {
  var token = sessionStorage.getItem("SESSION_TOKEN");
  var query = new URLSearchParams(window.location.search);
  var queryId = query.get("id");
  var openedFromHistory = query.get("origem") === "historico";
  var dashboardData = null;
  var chartInstances = {};
  var criteriaLabels = [
    { key: "destino", label: "Localização" },
    { key: "tipo", label: "Tipo de hospedagem" },
    { key: "acessibilidade", label: "Acessibilidade" },
    { key: "capacidade", label: "Capacidade" },
    { key: "idioma", label: "Idiomas" }
  ];

  function text(value, fallback) {
    if (value === null || value === undefined || String(value).trim() === "") {
      return fallback || "Não informado";
    }
    return String(value);
  }

  function number(value) {
    if (value === null || value === undefined || value === "") return null;
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatNumber(value, decimals) {
    var parsed = number(value);
    if (parsed === null) return "Não informado";
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: decimals === undefined ? 0 : decimals
    }).format(parsed);
  }

  function showError(message) {
    var error = document.createElement("section");
    error.className = "dashboard-load-error";
    var heading = document.createElement("strong");
    heading.textContent = "Não foi possível abrir o relatório.";
    var description = document.createElement("p");
    description.textContent = message;
    var back = document.createElement("a");
    back.href = openedFromHistory
      ? "../agente.html#historico-recomendacoes"
      : "../agente.html#geracao-recomendacoes";
    back.textContent = openedFromHistory
      ? "Voltar ao histórico de recomendações"
      : "Voltar para geração de recomendações";
    error.append(heading, description, back);
    document.body.appendChild(error);
    document.body.classList.add("dashboard-error");
    document.body.classList.remove("dashboard-loading");
  }

  function formatCnpj(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 14) return text(value);
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }

  function formatPhone(value) {
    var digits = String(value || "").replace(/\D/g, "");
    if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
    if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
    return text(value);
  }

  function formatDate(value) {
    if (!value) return "Não informado";
    var parts = String(value).slice(0, 10).split("-");
    if (parts.length !== 3 || parts[0].length !== 4) return text(value);
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var now = new Date();
    var years = now.getFullYear() - year;
    if (now.getMonth() + 1 < month ||
        (now.getMonth() + 1 === month && now.getDate() < day)) years--;
    var date = parts[2] + "/" + parts[1] + "/" + parts[0];
    return date + " (" + Math.max(years, 0) + " anos de atuação)";
  }

  function scoreCategory(score) {
    if (score < 50) return { label: "Baixa compatibilidade", className: "compat-low" };
    if (score < 70) return { label: "Compatibilidade regular", className: "compat-regular" };
    if (score < 80) return { label: "Compatibilidade moderada", className: "compat-moderate" };
    if (score < 90) return { label: "Alta compatibilidade", className: "compat-high" };
    return { label: "Compatibilidade ideal", className: "compat-ideal" };
  }

  function setText(selector, value) {
    var element = document.querySelector(selector);
    if (element) element.textContent = value;
  }

  function setKpiValue(element, value, unit) {
    var valueElement = element.querySelector(".valor-kpi");
    valueElement.replaceChildren(document.createTextNode(value + " "));
    var unitElement = document.createElement("span");
    unitElement.className = "unidade-kpi";
    unitElement.textContent = unit;
    valueElement.appendChild(unitElement);
  }

  function setKpiSub(element, message) {
    element.querySelector(".sub-kpi").textContent = message;
  }

  function setContactRow(row, label, value, url) {
    var heading = document.createElement("strong");
    heading.textContent = label + ":";
    row.replaceChildren(heading, document.createTextNode(" "));
    if (url) {
      var link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = value;
      row.appendChild(link);
    } else {
      row.appendChild(document.createTextNode(value));
    }
  }

  function safeWebsite(value) {
    if (!value) return null;
    var candidate = /^https?:\/\//i.test(value) ? value : "https://" + value;
    try {
      var parsed = new URL(candidate);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch (error) {
      return null;
    }
  }

  function criteriaSummary(result) {
    var criteria = result.criterios || {};
    var applicable = criteriaLabels.filter(function (criterion) {
      return criteria[criterion.key] !== null && criteria[criterion.key] !== undefined;
    });
    var matches = applicable.filter(function (criterion) {
      return criteria[criterion.key] === true;
    }).length;
    return {
      applicable: applicable,
      matches: matches,
      text: "Atende " + matches + " de " + applicable.length + " critérios da viagem."
    };
  }

  function renderHotelPanel(result, index, research) {
    var panel = document.getElementById("painelHotel" + (index + 1));
    var hotel = result.hospedagem || {};
    var score = number(result.compatibilidade) || 0;
    var category = scoreCategory(score);
    var criteria = result.criterios || {};
    var units = number(hotel.unidadesHabitacionais);
    var accessibleUnits = number(hotel.unidadesAcessiveis);
    var beds = number(hotel.leitos);
    var accessibleBeds = number(hotel.leitosAcessiveis);
    var summary = criteriaSummary(result);

    panel.querySelector(".tag-ranking").textContent = "#" + (index + 1) +
      (index === 0 ? " Mais compatível com a viagem" : " no ranking de compatibilidade");
    panel.querySelector(".nome-hotel").textContent = text(hotel.nomeFantasia, "Hospedagem");
    panel.querySelector(".local-hotel").textContent = [
      hotel.endereco,
      hotel.municipio,
      hotel.uf
    ].filter(Boolean).join(" - ") || "Localização não informada";

    var badges = panel.querySelectorAll(".status-badge");
    badges[0].className = "status-badge " + category.className;
    badges[0].textContent = category.label;
    badges[1].className = "status-badge regular";
    badges[1].textContent = "Recomendação #" + (index + 1);

    var kpis = panel.querySelectorAll(".card-kpi");
    setKpiValue(kpis[0], formatNumber(score), "/100");
    setKpiSub(kpis[0], summary.text);
    var indicatorColors = {
      "compat-ideal": "cor-ideal",
      "compat-high": "cor-alta",
      "compat-moderate": "cor-moderada",
      "compat-regular": "cor-regular",
      "compat-low": "cor-baixa"
    };
    kpis[0].querySelector(".bolinha-alerta").className =
      "bolinha-alerta " + indicatorColors[category.className];

    setKpiValue(kpis[1], formatNumber(units), "UHs");
    var accessibleUnitPercent = units && accessibleUnits !== null
      ? formatNumber((accessibleUnits / units) * 100, 1) + "%" : "Não informado";
    setKpiSub(kpis[1], "Sendo " + formatNumber(accessibleUnits) +
      " quartos acessíveis (" + accessibleUnitPercent + " do total).");

    setKpiValue(kpis[2], formatNumber(beds), "Leitos");
    var averageBeds = units && beds !== null ? formatNumber(beds / units, 2) : "Não informado";
    var capacityText = beds === null ? "Capacidade não informada."
      : beds >= Number(research.quantidadePessoas)
        ? "Atende ao grupo de " + research.quantidadePessoas + " viajante(s)."
        : "Não comporta todo o grupo de " + research.quantidadePessoas + " viajante(s).";
    setKpiSub(kpis[2], "Média de " + averageBeds + " leitos por quarto. " + capacityText);

    setKpiValue(kpis[3], formatNumber(accessibleBeds), "Leitos");
    var accessibleBedPercent = beds && accessibleBeds !== null
      ? formatNumber((accessibleBeds / beds) * 100, 1) + "%" : "Não informado";
    setKpiSub(kpis[3], accessibleBedPercent + " da capacidade total de leitos é acessível.");

    var ficha = panel.querySelectorAll(".item-ficha strong");
    var fichaValues = [
      text(hotel.nomeFantasia),
      formatCnpj(hotel.cnpj),
      text(hotel.tipoHospedagem),
      text(hotel.porte),
      formatDate(hotel.dataAbertura),
      "Não informado na base atual",
      "Não informado na base atual",
      text(hotel.cnaePrincipal)
    ];
    ficha.forEach(function (element, fichaIndex) {
      element.textContent = fichaValues[fichaIndex];
    });

    var languages = panel.querySelector(".badges-idiomas");
    languages.replaceChildren();
    var languageList = String(hotel.idiomas || "").split(",").map(function (item) {
      return item.trim();
    }).filter(Boolean);
    if (!languageList.length) languageList.push("Não informado");
    languageList.forEach(function (language) {
      var badge = document.createElement("span");
      badge.className = "badge-idioma";
      badge.textContent = language;
      languages.appendChild(badge);
    });

    var contacts = panel.querySelectorAll(".lista-contatos p");
    setContactRow(contacts[0], "Telefone Comercial", formatPhone(hotel.telefone));
    setContactRow(contacts[1], "E-mail Comercial", text(hotel.emailComercial));
    var website = text(hotel.website);
    setContactRow(contacts[2], "Website Oficial", website, safeWebsite(hotel.website));

    var justification = panel.querySelector(".box-justificativa p");
    var matched = summary.applicable.filter(function (criterion) {
      return criteria[criterion.key] === true;
    }).map(function (criterion) { return criterion.label; });
    var missed = summary.applicable.filter(function (criterion) {
      return criteria[criterion.key] === false;
    }).map(function (criterion) { return criterion.label; });
    var reason = matched.length
      ? "Atende aos critérios de " + matched.join(", ") + "."
      : "Não atende aos critérios avaliados da pesquisa.";
    if (missed.length) reason += " Não atende a " + missed.join(", ") + ".";
    justification.textContent = reason + " Compatibilidade final: " + score + "%.";

    panel.querySelectorAll(".legenda-grafico")[0].textContent =
      "Comparação entre unidades habitacionais e leitos acessíveis e convencionais.";
    panel.querySelectorAll(".legenda-grafico")[1].textContent =
      "Critérios comparados com as preferências informadas na pesquisa #" + research.id + ".";
  }

  function renderResearch(research) {
    setText("#pesquisa-id", String(dashboardData.id));
    setText("#resumo-cliente", text(research.nomeCliente, "Não informado"));
    setText("#resumo-destino", text(research.destino));
    setText("#resumo-tipo", text(research.tipoHospedagem, "Qualquer tipo"));
    setText("#resumo-hospedes", formatNumber(research.quantidadePessoas) + " pessoas");
    setText("#resumo-acessibilidade", research.precisaAcessibilidade ? "Obrigatória" : "Não obrigatória");
    setText("#resumo-idioma", text(research.idioma, "Não especificado"));
  }

  function chartDataFor(result) {
    var criteria = result.criterios || {};
    return criteriaLabels.map(function (criterion) {
      var value = criteria[criterion.key];
      return value === null || value === undefined ? null : value ? 100 : 0;
    });
  }

  function renderCharts(result, index) {
    if (typeof Chart !== "function") {
      var boxes = document.querySelectorAll("#painelHotel" + (index + 1) + " .canvas-holder");
      boxes.forEach(function (box) {
        var fallback = document.createElement("p");
        fallback.className = "legenda-grafico";
        fallback.textContent = "Os gráficos não puderam ser carregados. Os indicadores estão disponíveis acima.";
        box.appendChild(fallback);
      });
      return;
    }
    var suffix = index + 1;
    if (chartInstances[suffix]) {
      chartInstances[suffix].forEach(function (chart) { chart.destroy(); });
    }
    var hotel = result.hospedagem || {};
    var units = number(hotel.unidadesHabitacionais);
    var accessibleUnits = number(hotel.unidadesAcessiveis);
    var beds = number(hotel.leitos);
    var accessibleBeds = number(hotel.leitosAcessiveis);
    var capacityChart = new Chart(document.getElementById("chartCapacidade" + suffix), {
      type: "bar",
      data: {
        labels: ["Unidades Habitacionais (Quartos)", "Capacidade de Leitos"],
        datasets: [
          {
            label: "Acessíveis (PcD)",
            data: [accessibleUnits || 0, accessibleBeds || 0],
            backgroundColor: "#4E7D56",
            borderRadius: 4
          },
          {
            label: "Padrão (Convencional)",
            data: [
              units !== null && accessibleUnits !== null ? Math.max(units - accessibleUnits, 0) : units || 0,
              beds !== null && accessibleBeds !== null ? Math.max(beds - accessibleBeds, 0) : beds || 0
            ],
            backgroundColor: "#A37A5E",
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true } }
      }
    });

    var values = chartDataFor(result);
    var compatibilityChart = new Chart(document.getElementById("chartCompatibilidade" + suffix), {
      type: "bar",
      data: {
        labels: criteriaLabels.map(function (criterion) { return criterion.label; }),
        datasets: [{
          label: "Critério atendido (%)",
          data: values,
          backgroundColor: values.map(function (value) {
            return value === 100 ? "#4E7D56" : value === 0 ? "#A94438" : "#A37A5E";
          }),
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, max: 100 } }
      }
    });
    chartInstances[suffix] = [capacityChart, compatibilityChart];
  }

  function selectHotel(id) {
    var results = dashboardData.resultados;
    results.forEach(function (result, index) {
      var current = index + 1;
      var panel = document.getElementById("painelHotel" + current);
      var button = document.getElementById("btnHotel" + current);
      if (current === id) {
        panel.classList.remove("display-none");
        panel.classList.add("display-block");
        button.classList.remove("btn-inativo");
        button.classList.add("btn-ativo");
        renderCharts(result, index);
      } else {
        panel.classList.remove("display-block");
        panel.classList.add("display-none");
        button.classList.remove("btn-ativo");
        button.classList.add("btn-inativo");
      }
    });
  }

  function renderDashboard(data, user) {
    dashboardData = data;
    var results = data.resultados.slice(0, 3);
    if (!results.length) {
      throw new Error("A comparação não contém hospedagens recomendadas.");
    }
    setText("#b_usuario", text(user.nome, "Agente"));
    setText("#nome-empresa", text(user.agencia));
    renderResearch(data.cliente);

    results.forEach(function (result, index) {
      var button = document.getElementById("btnHotel" + (index + 1));
      button.hidden = false;
      button.textContent = (index + 1) + "º Lugar - " +
        text(result.hospedagem.nomeFantasia, "Hospedagem") +
        " (" + formatNumber(result.compatibilidade) + "%)";
      button.addEventListener("click", function () { selectHotel(index + 1); });
      renderHotelPanel(result, index, Object.assign({ id: data.id }, data.cliente));
    });
    for (var index = results.length + 1; index <= 3; index++) {
      document.getElementById("btnHotel" + index).hidden = true;
      document.getElementById("painelHotel" + index).classList.add("display-none");
    }
    window.selecionarHotel = selectHotel;
    selectHotel(1);
    document.body.classList.remove("dashboard-loading");
  }

  async function initialize() {
    if (!token) {
      window.location.href = "/login.html";
      return;
    }
    if (!queryId) {
      showError("O identificador da pesquisa não foi informado.");
      return;
    }
    try {
      var backLink = document.querySelector(".btn-nav-white a");
      if (openedFromHistory && backLink) {
        backLink.href = "../agente.html#historico-recomendacoes";
        backLink.querySelector("h3").textContent = "Voltar ao histórico";
      }
      var response = await fetch("/usuarios/sessao", {
        headers: { Authorization: "Bearer " + token }
      });
      if (!response.ok) {
        sessionStorage.clear();
        window.location.href = "/login.html";
        return;
      }
      var user = await response.json();
      if (user.cargo !== "agente") {
        window.location.href = "/login.html";
        return;
      }
      var data = null;
      if (!openedFromHistory) {
        var stored = sessionStorage.getItem("TOURWISE_DASHBOARD_RESULT");
        if (stored) {
          var cached = JSON.parse(stored);
          if (String(cached.id) === String(queryId)) data = cached;
        }
      }
      if (!data) {
        var historyResponse = await fetch("/recomendacoes/" + encodeURIComponent(queryId), {
          headers: { Authorization: "Bearer " + token }
        });
        if (historyResponse.status === 401) {
          sessionStorage.clear();
          window.location.href = "/login.html";
          return;
        }
        var historyResult = await historyResponse.json();
        if (!historyResponse.ok) {
          throw new Error(historyResult.mensagem || "Não foi possível carregar esta recomendação.");
        }
        data = historyResult.dashboard;
      }
      if (!data || !Array.isArray(data.resultados) || !data.cliente) {
        throw new Error("Os dados da comparação estão incompletos.");
      }
      renderDashboard(data, user);
    } catch (error) {
      showError(error.message);
    }
  }

  var logout = document.getElementById("dashboard-logout");
  if (logout) {
    logout.addEventListener("click", async function () {
      try {
        await fetch("/usuarios/sair", {
          method: "POST",
          headers: { Authorization: "Bearer " + token }
        });
      } catch (error) {
        console.error("Não foi possível encerrar a sessão no servidor.", error);
      } finally {
        sessionStorage.clear();
        window.location.href = "/login.html";
      }
    });
  }

  initialize();
})();
