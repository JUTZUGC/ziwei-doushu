/**
 * 查看本地解读数据集的导入状态
 * 用法：npm run data:status
 */

import { getDatasetStatus } from '../../lib/ziwei/dataset';

console.log(JSON.stringify(getDatasetStatus(), null, 2));
