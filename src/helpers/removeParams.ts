import { BASE_URL } from "../consts";

// remove params without touching base string
export const removeParams = (path: string): string => {
	return path.slice(0, path.length - new URL(path, BASE_URL).search.length);
};
