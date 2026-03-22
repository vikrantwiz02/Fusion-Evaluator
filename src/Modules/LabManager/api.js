import axios from 'axios';

// Use relative URLs so they work in both dev and production
const api = axios.create({
  baseURL: '/api/lab-manager',
  headers: {
    'Content-Type': 'application/json',
  }
});
let supportsSpecificationsEndpoint = true;

function shouldFallbackToLegacySpecsSave(error) {
  const status = error?.response?.status;
  const message = String(error?.response?.data?.error || '').toLowerCase();

  if (status === 404) return true;
  if (status === 403 && message.includes('admin access required')) return true;

  return false;
}

// Attach JWT token from localStorage on every request
api.interceptors.request.use((config) => {
  const rawUser = window.localStorage.getItem('lab-user');
  if (!rawUser) return config;

  try {
    const user = JSON.parse(rawUser);
    const token = user?.token;
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // Ignore malformed local storage values.
  }

  return config;
});

// Handle expired / invalid token — dispatch event so GlobalRoutes can log out
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(error);
  }
);

export const loginWithGoogle = async (credential) => {
  const { data } = await api.post('/auth/google', { credential });
  return data;
};

export const fetchAllModules = async (scope = 'lead') => {
  try {
    const { data } = await api.get('/modules', { params: { scope } });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch modules');
  }
};

export const fetchModuleDetails = async (moduleId) => {
  try {
    const { data } = await api.get(`/modules/${moduleId}`);
    // Ensure data is valid
    if (data && typeof data === 'object' && data.id && Array.isArray(data.groups)) {
      return data;
    }
    throw new Error('Invalid module data structure received');
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch module details');
  }
};

export const createModule = async (moduleData) => {
  const { data } = await api.post('/modules', moduleData);
  return data;
};

export const updateModule = async (moduleId, moduleData) => {
  const { data } = await api.put(`/modules/${moduleId}`, moduleData);
  return data;
};

export const deleteModule = async (moduleId) => {
  const { data } = await api.delete(`/modules/${moduleId}`);
  return data;
};

export const duplicateModule = async (moduleId) => {
  const { data } = await api.post(`/modules/${moduleId}/duplicate`);
  return data;
};

export const createGroup = async (moduleId, groupData) => {
  const { data } = await api.post(`/modules/${moduleId}/groups`, groupData);
  return data;
};

export const updateGroup = async (moduleId, groupId, groupData) => {
  const { data } = await api.put(`/modules/${moduleId}/groups/${groupId}`, groupData);
  return data;
};

export const deleteGroup = async (moduleId, groupId) => {
  const { data } = await api.delete(`/modules/${moduleId}/groups/${groupId}`);
  return data;
};

export const duplicateGroup = async (moduleId, groupId) => {
  const { data } = await api.post(`/modules/${moduleId}/groups/${groupId}/duplicate`);
  return data;
};

export const updateEvaluation = async (moduleId, groupId, evaluationUpdates) => {
  const { data } = await api.put(`/modules/${moduleId}/groups/${groupId}/evaluation`, evaluationUpdates);
  return data;
};

export const mergePairs = async (moduleId, poorPairId, highPairId) => {
  const { data } = await api.post(`/modules/${moduleId}/merge`, { poorPairId, highPairId });
  return data;
};

export const fetchModuleSpecifications = async (moduleId) => {
  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.get(`/modules/${moduleId}/specifications`);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
      supportsSpecificationsEndpoint = false;
    }
  }

  const { data } = await api.get(`/modules/${moduleId}`);
  return {
    useCases: Array.isArray(data?.spec_use_cases) ? data.spec_use_cases : [],
    workflows: Array.isArray(data?.spec_workflows) ? data.spec_workflows : [],
    businessRules: Array.isArray(data?.spec_rules) ? data.spec_rules : [],
    layout: data?.spec_layout && typeof data.spec_layout === 'object' && !Array.isArray(data.spec_layout) ? data.spec_layout : {},
  };
};

export const saveModuleSpecifications = async (moduleId, payload) => {
  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.put(`/modules/${moduleId}/specifications`, payload);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (!shouldFallbackToLegacySpecsSave(error)) {
        throw error;
      }
      supportsSpecificationsEndpoint = false;
    }
  }

  // Backward-compatible fallback for backend instances missing the dedicated endpoint.
  const { data } = await api.put(`/modules/${moduleId}`, {
    spec_use_cases: payload.useCases,
    spec_workflows: payload.workflows,
    spec_rules: payload.businessRules,
    spec_layout: payload.layout,
  });

  return {
    useCases: Array.isArray(data?.spec_use_cases) ? data.spec_use_cases : [],
    workflows: Array.isArray(data?.spec_workflows) ? data.spec_workflows : [],
    businessRules: Array.isArray(data?.spec_rules) ? data.spec_rules : [],
    layout: data?.spec_layout && typeof data.spec_layout === 'object' && !Array.isArray(data.spec_layout) ? data.spec_layout : {},
  };
};

export const fetchTeamsModuleSpecifications = async (moduleId) => {
  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.get(`/modules/${moduleId}/team-specifications`);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }

  const { data } = await api.get(`/modules/${moduleId}`);
  return {
    useCases: Array.isArray(data?.team_spec_use_cases) ? data.team_spec_use_cases : [],
    workflows: Array.isArray(data?.team_spec_workflows) ? data.team_spec_workflows : [],
    businessRules: Array.isArray(data?.team_spec_rules) ? data.team_spec_rules : [],
    layout: data?.team_spec_layout && typeof data.team_spec_layout === 'object' && !Array.isArray(data.team_spec_layout) ? data.team_spec_layout : {},
  };
};

export const saveTeamsModuleSpecifications = async (moduleId, payload) => {
  if (supportsSpecificationsEndpoint) {
    try {
      const { data } = await api.put(`/modules/${moduleId}/team-specifications`, payload);
      return {
        useCases: Array.isArray(data?.useCases) ? data.useCases : [],
        workflows: Array.isArray(data?.workflows) ? data.workflows : [],
        businessRules: Array.isArray(data?.businessRules) ? data.businessRules : [],
        layout: data?.layout && typeof data.layout === 'object' && !Array.isArray(data.layout) ? data.layout : {},
      };
    } catch (error) {
      if (!shouldFallbackToLegacySpecsSave(error)) {
        throw error;
      }
      // Keep this flag false for this tab session to avoid repeated 403/404 noise.
      supportsSpecificationsEndpoint = false;
    }
  }

  const { data } = await api.put(`/modules/${moduleId}`, {
    team_spec_use_cases: payload.useCases,
    team_spec_workflows: payload.workflows,
    team_spec_rules: payload.businessRules,
    team_spec_layout: payload.layout,
  });

  return {
    useCases: Array.isArray(data?.team_spec_use_cases) ? data.team_spec_use_cases : [],
    workflows: Array.isArray(data?.team_spec_workflows) ? data.team_spec_workflows : [],
    businessRules: Array.isArray(data?.team_spec_rules) ? data.team_spec_rules : [],
    layout: data?.team_spec_layout && typeof data.team_spec_layout === 'object' && !Array.isArray(data.team_spec_layout) ? data.team_spec_layout : {},
  };
};

// ── Division CRUD ──────────────────────────────────────────────────────────────

export const createDivision = async (moduleId, divisionData) => {
  const { data } = await api.post(`/modules/${moduleId}/divisions`, divisionData);
  return data;
};

export const updateDivision = async (moduleId, divisionId, divisionData) => {
  const { data } = await api.put(`/modules/${moduleId}/divisions/${divisionId}`, divisionData);
  return data;
};

export const deleteDivision = async (moduleId, divisionId) => {
  const { data } = await api.delete(`/modules/${moduleId}/divisions/${divisionId}`);
  return data;
};

// ── Bulk timer ─────────────────────────────────────────────────────────────────

/**
 * Set (or clear) the access timer for multiple modules at once.
 * @param {string[]} moduleIds
 * @param {string|null} accessStart  ISO 8601 datetime or null to remove restriction
 * @param {string|null} accessEnd    ISO 8601 datetime or null to remove restriction
 */
export const bulkUpdateTimer = async (moduleIds, accessStart, accessEnd, applyForLeads = true, applyForTeams = true) => {
  const { data } = await api.put('/modules/bulk-timer', {
    moduleIds,
    access_start: accessStart,
    access_end: accessEnd,
    applyForLeads,
    applyForTeams,
  });
  return data;
};

export default api;
