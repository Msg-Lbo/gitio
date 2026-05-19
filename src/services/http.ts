import axios from 'axios';

export const http = axios.create({
  timeout: 20_000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * 为后续 GitLab/Gerrit REST 能力预留统一鉴权入口。
 * 当前核心 Git 能力通过本地 Git CLI 执行，HTTP 层用于扩展服务端 API。
 *
 * @param token 访问令牌，可为空。
 * @return 无返回值。
 */
export function setProviderToken(token?: string) {
  if (token) {
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  delete http.defaults.headers.common.Authorization;
}
