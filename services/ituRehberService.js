const BASE_URL = 'https://mobil.itu.edu.tr/v2/service/service.aspx';
const DEFAULT_HEADERS = {
    'host': 'mobil.itu.edu.tr',
    'accept': 'application/json, text/plain, */*',
    'accept-encoding': 'gzip',
    'user-agent': 'okhttp/4.12.0'
};

class ItuRehberService {
    constructor() {
        this.detailCache = new Map();
    }

    async searchPerson(fullName) {
        try {
            const url = `${BASE_URL}?method=SearchPersonWithFullName&FullName=${encodeURIComponent(fullName)}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: DEFAULT_HEADERS
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.PersonList) {
                const validPersons = data.PersonList.filter(p =>
                    p.UnitName || p.ParentUnitName || p.PrimaryIdentityTypeName || p.AcademicTitle
                );
                return validPersons;
            }
            return [];
        } catch (error) {
            console.error('[RehberService] searchPerson Error:', error);
            throw error;
        }
    }

    async getPersonDetails(publicObjectId) {
        if (this.detailCache.has(publicObjectId)) {
            return this.detailCache.get(publicObjectId);
        }

        try {
            const url = `${BASE_URL}?method=GetPersonContactInformationList&publicObjectId=${publicObjectId}&Locale=tr`;
            const response = await fetch(url, {
                method: 'GET',
                headers: DEFAULT_HEADERS
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.ContactList) {
                this.detailCache.set(publicObjectId, data.ContactList);
                return data.ContactList;
            }
            return [];
        } catch (error) {
            console.error('[RehberService] getPersonDetails Error:', error);
            throw error;
        }
    }
}

export default new ItuRehberService();
