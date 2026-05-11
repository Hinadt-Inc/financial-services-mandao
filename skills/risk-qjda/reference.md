# 风控-全景指数 完整字段参考

## result_detail 字段（逾期）

| 字段           | 说明                                        |
| -------------- | ------------------------------------------- |
| `member_count` | 逾期机构数（近6个月内发生过逾期的机构数量） |
| `order_count`  | 逾期订单数（近6个月内逾期的订单总笔数）     |
| `debt_amount`  | 逾期总金额（近6个月逾期金额累加，单位：元） |
| `debt_detail`  | 逾期详情列表（见下）                        |

### debt_detail 列表项

| 字段       | 说明                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `endDay`   | 逾期时间（YYYY-MM）                                                                            |
| `billType` | 账期类型+账龄：S=超短期（7/14/21天），M=多期（30天+）；S0/M0=当期，S1/M1=逾期1个账期，以此类推 |
| `endMoney` | 逾期金额（单位：元）                                                                           |
| `endFlag`  | 是否结清：Y=已结清，N=未结清                                                                   |

## result_detail 字段（共债）

| 字段                     | 说明                                  |
| ------------------------ | ------------------------------------- |
| `current_org_count`      | 近1月共债机构数                       |
| `current_order_count`    | 近1月共债订单数                       |
| `current_order_amt`      | 近1月共债订单已还款金额               |
| `current_order_lend_amt` | 近1月共债订单金额                     |
| `totaldebt_detail`       | 历史共债列表（当前自然月前6个自然月） |

### totaldebt_detail 列表项

| 字段                       | 说明                        |
| -------------------------- | --------------------------- |
| `totaldebt_date`           | 共债统计时间范围（YYYY-MM） |
| `totaldebt_org_count`      | 共债机构数                  |
| `totaldebt_order_count`    | 共债订单数                  |
| `totaldebt_order_amt`      | 共债订单已还款金额          |
| `totaldebt_order_lend_amt` | 共债订单金额                |
| `new_or_old`               | 疑似借新还旧：Y=是，N=否    |

## 响应示例

### 查询成功

```json
{
  "success": true,
  "data": {
    "fee": "Y",
    "code": "0",
    "desc": "查询成功",
    "versions": "1.3.0",
    "result_detail": {
      "debt_amount": "6900",
      "order_count": "6",
      "member_count": "4",
      "debt_detail": [
        {
          "billType": "M1",
          "endDay": "2019-05",
          "endFlag": "N",
          "endMoney": "1000-2000"
        },
        {
          "billType": "M0",
          "endDay": "2018-12",
          "endFlag": "Y",
          "endMoney": "1-1000"
        }
      ],
      "totaldebt_detail": [
        {
          "totaldebt_date": "2019-04",
          "totaldebt_org_count": "3",
          "totaldebt_order_count": "5",
          "new_or_old": "N"
        }
      ]
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
