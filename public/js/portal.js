(function () {
  var token = sessionStorage.getItem("SESSION_TOKEN");
  var roleRoutes = { adm: "administrador.html", gestor: "gestor.html", agente: "agente.html" };
  var hotelCache = [];
  var hotelRequestId = 0;

  function showMessage(elementId, message, isError) {
    var element = document.getElementById(elementId);
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("error", Boolean(isError));
  }

  async function api(url, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers || {}, {
      Authorization: "Bearer " + token
    });
    if (options.body && typeof options.body !== "string") {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }

    var response = await fetch(url, options);
    if (response.status === 401) {
      sessionStorage.clear();
      window.location.href = "/login.html";
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    if (response.status === 204) return null;
    var contentType = response.headers.get("content-type") || "";
    var result = contentType.indexOf("application/json") !== -1
      ? await response.json()
      : await response.text();
    if (!response.ok) {
      throw new Error(result && result.mensagem ? result.mensagem : result || "Não foi possível concluir a operação.");
    }
    return result;
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formValues(form) {
    var values = {};
    new FormData(form).forEach(function (value, key) {
    values[key] = key === "senha" ? value : (typeof value === "string" ? value.trim() : value);
    });
    return values;
  }

  function clearForm(form) {
    form.reset();
    form.elements.id.value = "";
    var passwordNote = form.querySelector("[data-password-note]");
    if (passwordNote) passwordNote.textContent = "(obrigatória)";
    var passwordInput = form.elements.senha;
    if (passwordInput) passwordInput.required = true;
    var cancel = form.querySelector("[data-cancel-edit]");
    if (cancel) cancel.hidden = true;
  }

  function fillForm(form, item, fields) {
    var aliases = {
      nome_fantasia: "nomeFantasia",
      tipo_hospedagem: "tipoHospedagem",
      email_comercial: "emailComercial",
      uni_habit: "unidadesHabitacionais",
      uni_habit_acess: "unidadesAcessiveis",
      leito_acess: "leitosAcessiveis",
      dt_abertura: "dataAbertura",
      validade_certificado: "validadeCertificado"
    };
    form.elements.id.value = item.id;
    fields.forEach(function (field) {
      var input = form.elements[field];
      var value = item[aliases[field] || field];
      if (input) input.value = value === null || value === undefined ? "" : value;
    });
    var passwordNote = form.querySelector("[data-password-note]");
    if (passwordNote) passwordNote.textContent = "(deixe em branco para manter)";
    var passwordInput = form.elements.senha;
    if (passwordInput) passwordInput.required = false;
    var cancel = form.querySelector("[data-cancel-edit]");
    if (cancel) cancel.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function renderCards(container, items, options) {
    container.replaceChildren();
    if (!items.length) {
      container.appendChild(createElement("p", "portal-empty", options.emptyText || "Nenhum registro encontrado."));
      return;
    }

    items.forEach(function (item) {
      var card = createElement("article", "portal-card");
      card.appendChild(createElement("h3", "", options.title(item)));
      card.appendChild(createElement("p", "", options.subtitle(item)));
      var details = options.details ? options.details(item) : [];
      if (!Array.isArray(details)) details = details ? [details] : [];
      details.forEach(function (detail) {
        card.appendChild(createElement("p", "", detail));
      });

      if (options.edit || options.remove) {
        var actions = createElement("div", "portal-actions");
        if (options.edit) {
          var edit = createElement("button", "portal-button secondary small", "Editar");
          edit.type = "button";
          edit.addEventListener("click", function () { options.edit(item); });
          actions.appendChild(edit);
        }
        if (options.remove) {
          var remove = createElement("button", "portal-button danger small", "Excluir");
          remove.type = "button";
          remove.addEventListener("click", function () {
            if (window.confirm("Deseja realmente excluir este registro?")) options.remove(item);
          });
          actions.appendChild(remove);
        }
        card.appendChild(actions);
      }
      container.appendChild(card);
    });
  }

  function renderPagination(containerId, pagination, onPageChange) {
    var container = document.getElementById(containerId);
    if (!container) return;
    container.replaceChildren();

    var page = Number(pagination.page);
    var pageSize = Number(pagination.pageSize);
    var total = Number(pagination.total);
    var totalPages = Number(pagination.totalPages);
    var start = total ? (page - 1) * pageSize + 1 : 0;
    var end = Math.min(page * pageSize, total);
    container.appendChild(createElement("span", "portal-pagination-summary",
      total ? "Mostrando " + start + "–" + end + " de " + total : "Nenhum registro encontrado"));
    if (totalPages <= 1) return;

    function addPageButton(label, targetPage, disabled, current) {
      var button = createElement("button", "portal-page-button" + (current ? " active" : ""), label);
      button.type = "button";
      button.disabled = disabled;
      if (current) button.setAttribute("aria-current", "page");
      button.addEventListener("click", function () { onPageChange(targetPage); });
      container.appendChild(button);
    }

    addPageButton("Anterior", page - 1, page <= 1, false);
    var firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
    var lastPage = Math.min(totalPages, firstPage + 4);
    for (var currentPage = firstPage; currentPage <= lastPage; currentPage++) {
      addPageButton(String(currentPage), currentPage, false, currentPage === page);
    }
    addPageButton("Próxima", page + 1, page >= totalPages, false);
  }

  async function loadCrud(endpoint, listId, messageId, formId, fields, title, subtitle, details, emptyText, onPageData) {
    var form = document.getElementById(formId);
    var container = document.getElementById(listId);
    var paginationId = listId.replace(/-list$/, "-pagination");
    var currentPage = 1;
    var requestId = 0;
    async function refresh(page) {
      page = page || currentPage;
      var currentRequestId = ++requestId;
      try {
        var result = await api(endpoint + "?page=" + page + "&limit=10");
        if (currentRequestId !== requestId) return;
        if (!result || !Array.isArray(result.items) || !result.pagination) {
          throw new Error("A resposta da lista está em um formato inválido.");
        }
        currentPage = result.pagination.page;
        if (onPageData) onPageData(result.pagination);
        renderCards(container, result.items, {
          title: title,
          subtitle: subtitle,
          details: details,
          emptyText: emptyText,
          edit: function (item) { fillForm(form, item, fields); },
          remove: async function (item) {
            try {
              await api(endpoint + "/" + item.id, { method: "DELETE" });
              showMessage(messageId, "Registro excluído.");
              await refresh(currentPage);
            } catch (error) {
              showMessage(messageId, error.message, true);
            }
          }
        });
        renderPagination(paginationId, result.pagination, refresh);
      } catch (error) {
        if (currentRequestId !== requestId) return;
        showMessage(messageId, error.message, true);
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var values = formValues(form);
      var id = values.id;
      delete values.id;
      if (!values.senha) delete values.senha;
      try {
        await api(id ? endpoint + "/" + id : endpoint, {
          method: id ? "PUT" : "POST",
          body: values
        });
        showMessage(messageId, id ? "Alterações salvas." : "Registro cadastrado.");
        clearForm(form);
        await refresh(currentPage);
      } catch (error) {
        showMessage(messageId, error.message, true);
      }
    });

    var cancel = form.querySelector("[data-cancel-edit]");
    if (cancel) cancel.addEventListener("click", function () { clearForm(form); });
    await refresh();
  }

  async function loadAdmin() {
    var kpis = document.getElementById("admin-kpis");
    try {
      var totals = await api("/administradores/resumo");
      [
        ["Agências / Gestores", totals.agencias],
        ["Administradores", totals.administradores],
        ["Agentes", totals.agentes],
        ["Hospedagens", totals.hospedagens]
      ].forEach(function (entry) {
        var card = createElement("div", "portal-kpi");
        card.appendChild(createElement("span", "", entry[0]));
        card.appendChild(createElement("strong", "", String(entry[1])));
        kpis.appendChild(card);
      });
    } catch (error) {
      showMessage("agency-message", error.message, true);
    }

    await loadCrud("/agencias", "agency-list", "agency-message", "agency-form",
      ["nome", "email"], function (item) { return item.nome; },
      function (item) { return item.email; },
      function (item) { return [Number(item.totalAgentes) + " agente(s)"]; },
      "Nenhuma agência cadastrada.");

    await loadCrud("/administradores", "admin-list", "admin-message", "admin-form",
      ["nome", "email"], function (item) { return item.nome; },
      function (item) { return item.email; }, null,
      "Nenhum administrador cadastrado.");

    await loadCrud("/hospedagens", "hotel-list", "hotel-message", "hotel-form",
      ["nome_fantasia", "tipo_hospedagem", "municipio", "uf", "cnpj", "endereco",
        "email_comercial", "uni_habit", "leitos", "uni_habit_acess", "leito_acess",
        "dt_abertura", "website", "porte"],
      function (item) { return item.nomeFantasia; },
      function (item) { return (item.tipoHospedagem || "Hospedagem") + " · " + (item.municipio || "") + "/" + (item.uf || ""); },
      function (item) { return ["Leitos: " + (item.leitos || "não informado"), "Acessíveis: " + (item.leitosAcessiveis || 0)]; },
      "Nenhuma hospedagem cadastrada.");
  }

  async function loadManager() {
    await loadCrud("/usuarios", "agent-list", "agent-message", "agent-form",
      ["nome", "email"], function (item) { return item.nome; },
      function (item) { return item.email; },
      function (item) { return "Agência: " + (item.agencia || sessionStorage.getItem("NOME_AGENCIA") || ""); },
      "Ainda não há agentes nesta agência.",
      function (pagination) {
        var kpis = document.getElementById("manager-kpis");
        kpis.replaceChildren();
        var card = createElement("div", "portal-kpi");
        card.appendChild(createElement("span", "", "Agentes vinculados"));
        card.appendChild(createElement("strong", "", String(pagination.total)));
        kpis.appendChild(card);
      });
  }

  function renderHotels(items, container, emptyText) {
    container.replaceChildren();
    if (!items.length) {
      container.appendChild(createElement("p", "portal-empty", emptyText));
      return;
    }

    items.forEach(function (item) {
      var card = createElement("article", "portal-hotel-card");
      var artwork = createElement("div", "portal-hotel-art");
      artwork.appendChild(createElement("span", "portal-hotel-tag", item.tipoHospedagem || "Hospedagem"));
      artwork.appendChild(createElement("span", "portal-hotel-art-mark", "TW"));
      card.appendChild(artwork);

      var content = createElement("div", "portal-hotel-content");
      content.appendChild(createElement("h3", "", item.nomeFantasia || "Hospedagem"));
      content.appendChild(createElement("p", "portal-hotel-location",
        [item.municipio, item.uf].filter(Boolean).join(" · ") || "Localização não informada"));
      var facts = createElement("div", "portal-hotel-facts");
      facts.appendChild(createElement("span", "", item.leitos === null || item.leitos === undefined
        ? "Leitos não informados" : item.leitos + " leitos"));
      if (item.leitosAcessiveis) {
        facts.appendChild(createElement("span", "", item.leitosAcessiveis + " leitos acessíveis"));
      }
      content.appendChild(facts);

      var actions = createElement("div", "portal-actions");
      var detailsButton = createElement("button", "portal-button secondary", "Ver detalhes");
      detailsButton.type = "button";
      detailsButton.addEventListener("click", function () { openHotelDetails(item.id); });
      actions.appendChild(detailsButton);
      var recommendButton = createElement("button", "portal-button", "Gerar recomendação");
      recommendButton.type = "button";
      recommendButton.addEventListener("click", function () {
        selectRecommendationHotel(item);
      });
      actions.appendChild(recommendButton);
      content.appendChild(actions);
      card.appendChild(content);
      container.appendChild(card);
    });
  }

  function showAgentView(viewName) {
    document.querySelectorAll("[data-agent-view]").forEach(function (view) {
      view.hidden = view.dataset.agentView !== viewName;
    });
    document.querySelectorAll("[data-agent-nav]").forEach(function (link) {
      var active = link.dataset.agentNav === viewName;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    var target = document.querySelector('[data-agent-nav="' + viewName + '"]');
    if (target && window.location.hash !== target.getAttribute("href")) {
      window.history.replaceState(null, "", target.getAttribute("href"));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHotelDetails(hotel) {
    var content = document.getElementById("hotel-details-content");
    content.replaceChildren();
    content.appendChild(createElement("p", "portal-eyebrow", hotel.tipoHospedagem || "Hospedagem"));
    var title = createElement("h2", "", hotel.nomeFantasia || "Hospedagem");
    title.id = "hotel-details-title";
    content.appendChild(title);
    content.appendChild(createElement("p", "portal-hotel-location",
      [hotel.endereco, hotel.municipio, hotel.uf].filter(Boolean).join(" · ") || "Localização não informada"));

    var details = [
      ["Leitos", hotel.leitos],
      ["Unidades habitacionais", hotel.unidadesHabitacionais],
      ["Leitos acessíveis", hotel.leitosAcessiveis],
      ["Unidades acessíveis", hotel.unidadesAcessiveis],
      ["E-mail comercial", hotel.emailComercial],
      ["Website", hotel.website],
      ["Porte", hotel.porte]
    ];
    var list = createElement("dl", "portal-hotel-detail-list");
    details.forEach(function (detail) {
      if (detail[1] === null || detail[1] === undefined || detail[1] === "") return;
      list.appendChild(createElement("dt", "", detail[0]));
      list.appendChild(createElement("dd", "", String(detail[1])));
    });
    content.appendChild(list);
    if (hotel.idiomas) {
      content.appendChild(createElement("p", "portal-note", "Idiomas: " + hotel.idiomas));
    }
  }

  async function openHotelDetails(id) {
    try {
      var hotel = await api("/hospedagens/" + id);
      renderHotelDetails(hotel);
      document.getElementById("hotel-details-dialog").showModal();
    } catch (error) {
      showMessage("hotel-message", error.message, true);
    }
  }

  function populateHotelOptions(tipos) {
    var typeFilter = document.getElementById("hotel-type-filter");
    var clientType = document.getElementById("client-type");
    tipos.forEach(function (item) {
      var type = item.tipoHospedagem;
      [typeFilter, clientType].forEach(function (select) {
        var option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
      });
    });
  }

  function selectRecommendationHotel(hotel) {
    var select = document.getElementById("recommendation-hotel");
    var option = Array.from(select.options).find(function (item) {
      return item.value === String(hotel.id);
    });
    if (!option) {
      option = document.createElement("option");
      option.value = String(hotel.id);
      option.textContent = hotel.nomeFantasia;
      select.appendChild(option);
    }
    select.value = String(hotel.id);
    showAgentView("geracao-recomendacoes");
  }

  async function loadHotels(page) {
    var requestId = ++hotelRequestId;
    var params = new URLSearchParams({ page: String(page || 1), limit: "10" });
    var search = document.getElementById("hotel-search").value.trim();
    var type = document.getElementById("hotel-type-filter").value;
    var municipality = document.getElementById("hotel-city-filter").value.trim();
    if (search) params.set("busca", search);
    if (type) params.set("tipoHospedagem", type);
    if (municipality) params.set("municipio", municipality);

    try {
      var result = await api("/hospedagens?" + params.toString());
      if (requestId !== hotelRequestId) return;
      if (!result || !Array.isArray(result.items) || !result.pagination) {
        throw new Error("A resposta da lista de hospedagens está em um formato inválido.");
      }
      hotelCache = result.items;
      renderHotels(hotelCache, document.getElementById("agent-hotel-list"),
        "Nenhuma hospedagem encontrada com esses filtros.");
      showMessage("hotel-count", result.pagination.total +
        (result.pagination.total === 1 ? " hospedagem encontrada" : " hospedagens encontradas"));
      renderPagination("agent-hotel-pagination", result.pagination, loadHotels);
    } catch (error) {
      if (requestId !== hotelRequestId) return;
      showMessage("hotel-message", error.message, true);
    }
  }

  async function loadAgent() {
    var searchTimer;
    try {
      var tipos = await api("/hospedagens/tipos");
      if (!Array.isArray(tipos)) {
        throw new Error("A resposta dos tipos de hospedagem está em um formato inválido.");
      }
      populateHotelOptions(tipos);
    } catch (error) {
      showMessage("hotel-message", error.message, true);
    }

    document.getElementById("hotel-search").addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () { loadHotels(1); }, 300);
    });
    document.getElementById("hotel-type-filter").addEventListener("change", function () { loadHotels(1); });
    document.getElementById("hotel-city-filter").addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(function () { loadHotels(1); }, 300);
    });
    document.getElementById("hotel-filter-toggle").addEventListener("click", function () {
      var filters = document.getElementById("hotel-filters");
      var expanded = this.getAttribute("aria-expanded") === "true";
      this.setAttribute("aria-expanded", String(!expanded));
      filters.hidden = expanded;
    });

    document.querySelectorAll("[data-agent-nav]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        showAgentView(link.dataset.agentNav);
      });
    });
    showAgentView(window.location.hash === "#geracao-recomendacoes"
      ? "geracao-recomendacoes" : "hospedagens");

    document.getElementById("hotel-details-close").addEventListener("click", function () {
      document.getElementById("hotel-details-dialog").close();
    });

    var recommendationInput = null;
    async function generateRecommendations(values, page) {
      var request = Object.assign({}, values, { pagina: page || 1 });
      try {
        var result = await api("/comparacoes", { method: "POST", body: request });
        var total = result.paginacao ? result.paginacao.total : result.resultados.length;
        var client = result.cliente.nome ? " para " + result.cliente.nome : "";
        showMessage("compare-message", total
          ? total + " recomendação(ões) gerada(s)" + client + ". Os dados do cliente não foram salvos."
          : "Não há hospedagens cadastradas para gerar recomendações.");
        renderComparison(result.resultados);
        if (result.paginacao) {
          renderPagination("compare-pagination", result.paginacao, function (nextPage) {
            generateRecommendations(recommendationInput, nextPage);
          });
        }
      } catch (error) {
        showMessage("compare-message", error.message, true);
      }
    }

    document.getElementById("compare-form").addEventListener("submit", async function (event) {
      event.preventDefault();
      recommendationInput = formValues(event.currentTarget);
      recommendationInput.quantidadePessoas = Number(recommendationInput.quantidadePessoas);
      recommendationInput.precisaAcessibilidade = recommendationInput.precisaAcessibilidade === "true";
      if (!recommendationInput.hospedagemId) delete recommendationInput.hospedagemId;
      await generateRecommendations(recommendationInput, 1);
    });

    await loadHotels(1);
  }

  function renderComparison(results) {
    var container = document.getElementById("compare-results");
    container.replaceChildren();
    if (!results.length) {
      container.appendChild(createElement("p", "portal-empty", "Preencha os dados do cliente para ver as recomendações."));
      return;
    }
    results.forEach(function (result, index) {
      var hotel = result.hospedagem;
      var card = createElement("article", "portal-result");
      var top = createElement("div", "portal-result-top");
      var heading = createElement("div");
      heading.appendChild(createElement("p", "portal-eyebrow", index === 0 ? "Melhor correspondência" : "Recomendação " + (index + 1)));
      heading.appendChild(createElement("h3", "", hotel.nomeFantasia));
      heading.appendChild(createElement("p", "", (hotel.tipoHospedagem || "Hospedagem") + " · " + (hotel.municipio || "") + "/" + (hotel.uf || "")));
      top.appendChild(heading);
      var chart = createElement("div", "portal-donut");
      chart.style.setProperty("--score", result.compatibilidade + "%");
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", result.compatibilidade + "% de compatibilidade");
      chart.appendChild(createElement("strong", "", result.compatibilidade + "%"));
      top.appendChild(chart);
      card.appendChild(top);

      var labels = {
        destino: "Destino",
        tipo: "Tipo",
        capacidade: "Capacidade",
        acessibilidade: "Acessibilidade",
        idioma: "Idioma"
      };
      var criteria = createElement("div", "portal-criteria");
      Object.keys(labels).forEach(function (key) {
        var matched = result.criterios[key];
        if (matched === null) return;
        var criterion = createElement("span", matched ? "matched" : "missed",
          (matched ? "Atende" : "Não atende") + " · " + labels[key]);
        criteria.appendChild(criterion);
      });
      card.appendChild(criteria);
      var detailButton = createElement("button", "portal-button secondary small", "Ver hospedagem");
      detailButton.type = "button";
      detailButton.addEventListener("click", function () { openHotelDetails(hotel.id); });
      card.appendChild(detailButton);
      container.appendChild(card);
    });
  }

  async function initialize() {
    if (!token) {
      window.location.href = "/login.html";
      return;
    }
    try {
      var user = await api("/usuarios/sessao");
      var expectedRole = document.body.dataset.role;
      if (user.cargo !== expectedRole) {
        window.location.href = "/" + (roleRoutes[user.cargo] || "login.html");
        return;
      }
      document.querySelectorAll("[data-user-name]").forEach(function (element) {
        element.textContent = user.nome;
      });
      document.querySelectorAll("[data-agency-name]").forEach(function (element) {
        element.textContent = user.agencia || sessionStorage.getItem("NOME_AGENCIA") || "";
      });
      document.querySelectorAll("[data-logout]").forEach(function (button) {
        button.addEventListener("click", async function () {
          api("/usuarios/sair", { method: "POST" })
            .catch(function (error) { console.error("Não foi possível encerrar a sessão no servidor:", error); })
            .finally(function () {
              sessionStorage.clear();
              window.location.href = "/login.html";
            });
        });
      });

      if (document.body.dataset.page === "admin") await loadAdmin();
      if (document.body.dataset.page === "gestor") await loadManager();
      if (document.body.dataset.page === "agente") await loadAgent();
    } catch (error) {
      console.error("Não foi possível inicializar a área:", error);
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);
})();
