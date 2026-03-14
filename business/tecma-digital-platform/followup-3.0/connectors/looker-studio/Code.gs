/**
 * Followup 3.0 – Community Connector per Looker Studio
 * Espone i listati (appartamenti) tramite GET /v1/public/listings.
 * Configurare: API base URL, workspaceId, projectIds (comma-separated).
 */

function getAuthType() {
  var cc = DataStudioApp.createCommunityConnector();
  return cc.newAuthTypeResponse()
    .setAuthType(cc.AuthType.NONE)
    .build();
}

function getConfig(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var config = cc.getConfig();

  config.newTextInput()
    .setId('apiBaseUrl')
    .setName('API base URL')
    .setHelpText('URL base dell\'API Followup (es. https://api.example.com/v1). Senza slash finale.')
    .setPlaceholder('https://api.example.com/v1');

  config.newTextInput()
    .setId('workspaceId')
    .setName('Workspace ID')
    .setHelpText('ID del workspace Followup')
    .setPlaceholder('dev-1');

  config.newTextInput()
    .setId('projectIds')
    .setName('Project IDs')
    .setHelpText('ID progetti separati da virgola (es. proj-01,proj-02)')
    .setPlaceholder('proj-01,proj-02');

  config.setDateRangeRequired(false);
  return config.build();
}

function getSchema(request) {
  var cc = DataStudioApp.createCommunityConnector();
  var fields = cc.getFields();
  var types = cc.FieldType;

  fields.newDimension()
    .setId('_id')
    .setName('ID')
    .setDescription('ID appartamento')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('code')
    .setName('Codice')
    .setDescription('Codice unità')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('name')
    .setName('Nome')
    .setDescription('Nome appartamento')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('status')
    .setName('Stato')
    .setDescription('AVAILABLE, RESERVED, SOLD, RENTED')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('mode')
    .setName('Modalità')
    .setDescription('RENT o SELL')
    .setType(types.TEXT);

  fields.newMetric()
    .setId('surfaceMq')
    .setName('Superficie (mq)')
    .setDescription('Superficie in mq')
    .setType(types.NUMBER);

  fields.newMetric()
    .setId('priceAmount')
    .setName('Prezzo (importo)')
    .setDescription('Importo prezzo normalizzato')
    .setType(types.NUMBER);

  fields.newDimension()
    .setId('priceCurrency')
    .setName('Valuta prezzo')
    .setDescription('Codice valuta')
    .setType(types.TEXT);

  fields.newDimension()
    .setId('updatedAt')
    .setName('Aggiornato il')
    .setDescription('Data/ora ultimo aggiornamento')
    .setType(types.TEXT);

  return { schema: fields.build() };
}

function getData(request) {
  var config = request.configParams || {};
  var apiBase = (config.apiBaseUrl || '').toString().replace(/\/$/, '');
  var workspaceId = (config.workspaceId || '').toString().trim();
  var projectIdsRaw = (config.projectIds || '').toString().trim();
  if (!apiBase || !workspaceId || !projectIdsRaw) {
    throw new Error('Configura API base URL, Workspace ID e Project IDs nel connettore.');
  }
  var projectIds = projectIdsRaw.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (projectIds.length === 0) {
    throw new Error('Inserire almeno un Project ID.');
  }
  var requestedFields = (request.fields || []).map(function(f) { return f.name; });
  if (requestedFields.length === 0) {
    requestedFields = ['_id', 'code', 'name', 'status', 'mode', 'surfaceMq', 'priceAmount', 'priceCurrency', 'updatedAt'];
  }
  var url = apiBase + '/public/listings?workspaceId=' + encodeURIComponent(workspaceId) +
    '&projectIds=' + encodeURIComponent(projectIds.join(',')) +
    '&page=1&perPage=1000';
  var options = {
    method: 'get',
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error('API error: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
  var json = JSON.parse(response.getContentText());
  var data = json.data || [];
  var pagination = json.pagination || {};
  var total = pagination.total || 0;
  var page = 1;
  var allData = data.slice();
  while (allData.length < total && page < 50) {
    page++;
    var nextUrl = apiBase + '/public/listings?workspaceId=' + encodeURIComponent(workspaceId) +
      '&projectIds=' + encodeURIComponent(projectIds.join(',')) +
      '&page=' + page + '&perPage=1000';
    var nextResponse = UrlFetchApp.fetch(nextUrl, options);
    if (nextResponse.getResponseCode() !== 200) break;
    var nextJson = JSON.parse(nextResponse.getContentText());
    var nextData = nextJson.data || [];
    if (nextData.length === 0) break;
    allData = allData.concat(nextData);
  }
  var schema = requestedFields.map(function(name) {
    return { name: name, dataType: fieldDataType(name) };
  });
  var rows = allData.map(function(row) {
    return { values: requestedFields.map(function(name) { return getCellValue(row, name); }) };
  });
  return {
    schema: schema,
    rows: rows,
    filtersApplied: false
  };
}

function fieldDataType(name) {
  if (name === 'surfaceMq' || name === 'priceAmount') return 'NUMBER';
  return 'STRING';
}

function getCellValue(row, name) {
  if (name === '_id') return row._id != null ? String(row._id) : '';
  if (name === 'code') return row.code != null ? String(row.code) : '';
  if (name === 'name') return row.name != null ? String(row.name) : '';
  if (name === 'status') return row.status != null ? String(row.status) : '';
  if (name === 'mode') return row.mode != null ? String(row.mode) : '';
  if (name === 'surfaceMq') return row.surfaceMq != null ? Number(row.surfaceMq) : 0;
  if (name === 'priceAmount') {
    var np = row.normalizedPrice;
    return (np && np.amount != null) ? Number(np.amount) : 0;
  }
  if (name === 'priceCurrency') {
    var np = row.normalizedPrice;
    return (np && np.currency) ? String(np.currency) : '';
  }
  if (name === 'updatedAt') return row.updatedAt != null ? String(row.updatedAt) : '';
  return '';
}
