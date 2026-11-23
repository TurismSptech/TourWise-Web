var pageSizeLimit = 10;

function parseQuery(req, res) {
    var page = req.query.page === undefined ? 1 : Number(req.query.page);
    var pageSize = req.query.limit === undefined ? pageSizeLimit : Number(req.query.limit);

    if (!Number.isSafeInteger(page) || page < 1) {
        res.status(400).json({ mensagem: "O parâmetro page deve ser um inteiro positivo." });
        return null;
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > pageSizeLimit) {
        res.status(400).json({ mensagem: "O parâmetro limit deve ser um inteiro entre 1 e 10." });
        return null;
    }

    return { page: page, pageSize: pageSize };
}

function response(items, page, pageSize, total) {
    var totalPages = Math.ceil(total / pageSize);
    var currentPage = Math.min(page, Math.max(totalPages, 1));

    return {
        items: items,
        pagination: {
            page: currentPage,
            pageSize: pageSize,
            total: total,
            totalPages: totalPages
        }
    };
}

function paginateArray(items, page, pageSize) {
    var result = response([], page, pageSize, items.length);
    var start = (result.pagination.page - 1) * pageSize;
    result.items = items.slice(start, start + pageSize);
    return result;
}

module.exports = { parseQuery: parseQuery, response: response, paginateArray: paginateArray };
