import { Toast } from "@douyinfe/semi-ui";
import { IOpenTextSegment, bitable, FieldType, IOpenSingleSelect } from '@lark-base-open/js-sdk';
import $ from 'jquery';
import './index.scss';

$(async function () {
  const [tableList, selection] = await Promise.all([bitable.base.getTableMetaList(), bitable.base.getSelection()]);
  const optionsHtml = tableList.map(table => {
    return `<option value="${table.id}">${table.name}</option>`;
  }).join('');


  async function fillFields() {
    const tableId = $('#tableSelect').val() as string;
    const table = await bitable.base.getTableById(tableId);
    const fields = await table.getFieldMetaList();
    const optionsHtml = fields.map(field => {
      if (field.type == FieldType.Number) {
        return `<option value="${field.id}">${field.name}</option>`;
      }
      return '';
    }).join('');
    const optionsTypeHtml = fields.map(field => {
      if (field.type == FieldType.Text || field.type == FieldType.Number || field.type == FieldType.SingleSelect) {
        return `<option value="${field.id}">${field.name}</option>`;
      }
      return '';
    }).join('');
    $('#filedCalcSelect').empty();
    $('#filedCalcSelect').append(optionsHtml);
    $('#filedCalcSelect').val('');
    $('#filedRankSelect').empty();
    $('#filedRankSelect').append(optionsHtml);
    $('#filedRankSelect').val('');
    $('#filedTypeSelect').empty();
    $('#filedTypeSelect').append(optionsTypeHtml);
    $('#filedTypeSelect').val('');
  };

  $('#tableSelect').append(optionsHtml).val(selection.tableId!);
  $('#tableSelect').on('change', fillFields);
  fillFields();

  $('#calcRank').on('click', async function () {
    const tableId = $('#tableSelect').val() as string;
    const filedCalc = $('#filedCalcSelect').val() as string;
    const filedRank = $('#filedRankSelect').val() as string;
    const filedType = $('#filedTypeSelect').val() as string;
    const descType = $('#descTypeSelect').val() as string;
    if (!filedCalc) {
      Toast.error("请选择排序字段（计算）！");
      return;
    }
    if (!filedRank) {
      Toast.error("请选择排名字段（写入）");
      return;
    }
    const table = await bitable.base.getTableById(tableId);
    let flag = false;
    if (filedType) {
      flag = true;
    }
    //分页获取所有行数据
    let res = await table.getRecords({ pageSize: 500 });
    let records = res.records;
    while (res.hasMore) {
      res = await table.getRecords({ pageSize: 500, pageToken: res.pageToken });
      records = records.concat(res.records);
    }
    //排序
    for (let i = 1; i < records.length; i++) {
      let record = records[i];
      let count = record.fields[filedCalc] as number;
      let j = i - 1;
      if (descType == "2") {
        // 如果该元素大于前一个元素，那么前一个元素向后移动，并继续向前比较
        while (j >= 0 && records[j].fields[filedCalc] as number < count) {
          records[j + 1] = records[j];
          j--;
        }
      } else {
        // 如果该元素小于前一个元素，那么前一个元素向后移动，并继续向前比较
        while (j >= 0 && records[j].fields[filedCalc] as number > count) {
          records[j + 1] = records[j];
          j--;
        }
      }
      // 放到合适的位置
      records[j + 1] = record;
    }

    let recordsToSet = [];

    if (!flag) {
      let totalCur = null;
      let totalAllIdx = 1;
      //计算排序号
      for (let i = 0; i < records.length; i++) {
        let record = records[i];
        const count = record.fields[filedCalc] as number;
        let allIdx = totalAllIdx;
        if (totalCur != count) {
          totalCur = count;
          totalAllIdx = i + 1;
          allIdx = totalAllIdx;
        }
        recordsToSet[i] = {
          recordId: record.recordId,
          fields: {
            [filedRank]: allIdx
          }
        }
      }
    } else {
      let typeCurMap = {};//记录各类型当前值
      let typeRankMap = {};//记录各类型排名值
      let typeCntMap = {};//记录各类型的数量
      const typeCode = (await table.getFieldMetaById(filedType)).type;
      //计算排序号
      for (let i = 0; i < records.length; i++) {
        let record = records[i];
        const count = record.fields[filedCalc] as number;
        const typeCell = record.fields[filedType];
        let type = '';
        switch (typeCode) {
          case FieldType.Text:
            type = (typeCell as IOpenTextSegment[])[0].text as string;
            break;
          case FieldType.Number:
            type = '' + (typeCell as number);
            break;
          case FieldType.SingleSelect:
            type = (typeCell as IOpenSingleSelect).id;
            break;
          default:
            break;
        }
        // const typeCell = record.fields[filedType] as IOpenTextSegment[];
        // const type = typeCell[0].text as string;
        if (typeRankMap[type] == null) {
          typeRankMap[type] = 1;
          typeCntMap[type] = 0;
          typeCurMap[type] = null;
        }
        let typeIdx = typeRankMap[type];
        if (typeCurMap[type] != count) {
          typeCurMap[type] = count;
          typeRankMap[type] = typeCntMap[type] + 1;
          typeIdx = typeRankMap[type];
        }
        typeCntMap[type] = typeCntMap[type] + 1;

        recordsToSet[i] = {
          recordId: record.recordId,
          fields: {
            [filedRank]: typeIdx
          }
        }
      }
    }
    await table.setRecords(recordsToSet);
    console.log("success");
    Toast.success("success");
  });

});