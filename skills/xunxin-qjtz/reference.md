# 迅信-信用探查指数 完整字段参考

## result_detail 字段

| 字段                      | 类型   | 说明                                                         |
| ------------------------- | ------ | ------------------------------------------------------------ |
| `result_code`             | string | 探查结果：`1`=A(Overdue)，`2`=B(Normal)，`3`=B(Delay)，`4`=U |
| `max_overdue_amt`         | string | 最大逾期金额区间（0/1~1000/1000~2000/…）                     |
| `max_overdue_days`        | string | 最长逾期天数区间（0/1~15/16~30/31~60/…）                     |
| `latest_overdue_time`     | string | 最近逾期时间（YYYY-MM）                                      |
| `max_performance_amt`     | string | 最大履约金额区间（0/1~1000/1000~2000/…）                     |
| `latest_performance_time` | string | 最近履约时间（YYYY-MM）                                      |
| `count_performance`       | string | 履约笔数（0/1/2/…）                                          |
| `currently_overdue`       | string | 当前逾期机构数（0/1/2/…）                                    |
| `currently_performance`   | string | 当前履约机构数（0/1/2/…）                                    |
| `acc_exc`                 | string | 异常还款机构数（0/1/2/…）                                    |
| `acc_sleep`               | string | 睡眠机构数（0/1/2/…）                                        |

## 响应示例

### 查询成功（有逾期）

```json
{
  "success": true,
  "data": {
    "fee": "Y",
    "code": "0",
    "desc": "查询成功",
    "versions": "1.4.0",
    "result_detail": {
      "result_code": "1",
      "max_performance_amt": null,
      "count_performance": null,
      "latest_performance_time": null,
      "currently_overdue": "3",
      "max_overdue_amt": "2000-3000",
      "max_overdue_days": "16-30",
      "latest_overdue_time": "2018-07",
      "currently_performance": "27",
      "acc_exc": "0",
      "acc_sleep": "30"
    }
  }
}
```

### 查询未命中

```json
{
  "success": true,
  "data": {
    "fee": "N",
    "code": "1",
    "desc": "查询未命中",
    "result_detail": null
  }
}
```

### 响应异常

```json
{
  "success": false,
  "data": "null",
  "errorCode": "S1000",
  "errorMsg": "请求参数有误"
}
```
