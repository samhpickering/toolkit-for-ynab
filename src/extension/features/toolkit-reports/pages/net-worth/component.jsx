import Highcharts from 'highcharts';
import * as React from 'react';
import * as PropTypes from 'prop-types';
import { formatCurrency } from 'toolkit/extension/utils/currency';
import { localizedMonthAndYear, sortByGettableDate } from 'toolkit/extension/utils/date';
import { l10n } from 'toolkit/extension/utils/toolkit';
import { FiltersPropType } from 'toolkit-reports/common/components/report-context/component';
import { Legend } from './components/legend';
import { LabeledCheckbox } from 'toolkit-reports/common/components/labeled-checkbox';
import { getToolkitStorageKey, setToolkitStorageKey } from 'toolkit/extension/utils/toolkit';
import { Collections } from 'toolkit/extension/utils/collections';
import './styles.scss';
import { PIE_CHART_COLORS } from '../../common/constants/colors';

const STORAGE_KEYS = {
  inverseDebt: 'net-worth-inverse-debt',
  splitByAccount: 'net-worth-split-by-account',
};

export class NetWorthComponent extends React.Component {
  _accountsCollection = Collections.accountsCollection;

  static propTypes = {
    filters: PropTypes.shape(FiltersPropType),
    allReportableTransactions: PropTypes.array.isRequired,
  };

  state = {
    inverseDebt: getToolkitStorageKey(STORAGE_KEYS.inverseDebt, false),
    splitByAccount: getToolkitStorageKey(STORAGE_KEYS.splitByAccount, false),
  };

  componentDidMount() {
    this._calculateData();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.filters !== prevProps.filters ||
      this.props.allReportableTransactions !== prevProps.allReportableTransactions
    ) {
      this._calculateData();
    }
  }

  render() {
    return (
      <div className="tk-flex-grow tk-flex tk-flex-column">
        <div className="tk-flex tk-pd-05 tk-border-b">
          <div>
            <LabeledCheckbox
              id="tk-net-worth-inverse-debt-selector"
              checked={this.state.inverseDebt}
              label="Flip Debt"
              onChange={this.toggleDebtDirection}
            />
            <LabeledCheckbox
              id="tk-net-worth-split-by-account-selector"
              checked={this.state.splitByAccount}
              label="Split By Account"
              onChange={this.toggleSplitByAccount}
            />
          </div>
        </div>
        <div className="tk-flex tk-flex-column tk-flex-grow">
          <div className="tk-flex tk-justify-content-end">
            {this.state.hoveredData && (
              <Legend
                label={this.state.hoveredData.label}
                assets={this.state.hoveredData.assets}
                debts={this.state.hoveredData.debts}
                debtRatio={this.state.hoveredData.debtRatio}
                netWorth={this.state.hoveredData.netWorth}
              />
            )}
          </div>
          <div className="tk-net-worth-chart-outer-wrapper">
            <div className="tk-net-worth-chart-wrapper">
              <div>
                <div className="tk-highcharts-report-container" id="tk-net-worth-chart-debt-area" />
              </div>
            </div>
            <div className="tk-net-worth-chart-wrapper">
              <div>
                <div className="tk-highcharts-report-container" id="tk-net-worth-chart" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  toggleDebtDirection = () => {
    this.setState((prevState) => {
      const inverseDebt = !prevState.inverseDebt;
      setToolkitStorageKey(STORAGE_KEYS.inverseDebt, inverseDebt);
      return { inverseDebt };
    });
    this._calculateData();
  };

  toggleSplitByAccount = () => {
    this.setState((prevState) => {
      const splitByAccount = !prevState.splitByAccount;
      setToolkitStorageKey(STORAGE_KEYS.splitByAccount, splitByAccount);
      return { splitByAccount };
    });
    this._calculateData();
  };

  _renderReport = () => {
    function roundYAxis(y, add) {
      if (y === 0) return 0;
      const scale = Math.pow(10, Math.max(Math.floor(Math.log10(y)), 1));
      return (Math.ceil(y / scale) + add) * scale;
    }

    const _this = this;
    const { labels, debts, assets, debtRatios, netWorths, assetAccounts, debtAccounts } =
      this.state.reportData;

    const pointHover = {
      events: {
        mouseOver: function () {
          _this.setState({
            hoveredData: {
              label: labels[this.index],
              assets: assets[this.index],
              debts: debts[this.index],
              debtRatio: debtRatios[this.index],
              netWorth: netWorths[this.index],
            },
          });
        },
      },
    };

    if (!this.state.splitByAccount) {
      const chart = new Highcharts.Chart({
        credits: false,
        chart: {
          backgroundColor: 'transparent',
          renderTo: 'tk-net-worth-chart',
        },
        legend: { enabled: false },
        title: { text: '' },
        tooltip: { enabled: false },
        xAxis: {
          categories: labels,
          labels: {
            style: { color: 'var(--label_primary)' },
          },
        },
        yAxis: {
          title: { text: '' },
          labels: {
            formatter: function () {
              return formatCurrency(this.value);
            },
            style: { color: 'var(--label_primary)' },
          },
        },
        plotOptions: {
          series: {
            states: {
              inactive: {
                enabled: false,
              },
            },
          },
        },
        series: [
          {
            id: 'debts',
            type: 'column',
            name: l10n('toolkit.debts', 'Debts'),
            color: 'rgba(234,106,81,1)',
            data: this.state.inverseDebt ? debts.map((item) => -item) : debts,
            pointPadding: 0,
            point: pointHover,
          },
          {
            id: 'assets',
            type: 'column',
            name: l10n('toolkit.assets', 'Assets'),
            color: 'rgba(142,208,223,1)',
            data: assets,
            pointPadding: 0,
            point: pointHover,
          },
          {
            id: 'networth',
            type: 'area',
            name: l10n('toolkit.netWorth', 'Net Worth'),
            fillColor: 'rgba(244,248,226,0.5)',
            negativeFillColor: 'rgba(247, 220, 218, 0.5)',
            data: netWorths,
            point: pointHover,
          },
        ],
      });
      $('#tk-net-worth-chart-debt-area').html('');
      this.setState({ chart });
    } else {
      let yMax = 0;
      labels.forEach((label, index) => {
        let total = 0;
        assetAccounts.forEach((account) => {
          total += account.data[index];
        });
        yMax = Math.max(yMax, total);
      });
      yMax = roundYAxis(yMax, 1);

      let yMin = 0;
      labels.forEach((label, index) => {
        let total = 0;
        debtAccounts.forEach((account) => {
          total += account.data[index] || 0;
        });
        yMin = Math.min(yMin, total);
      });
      yMin = -roundYAxis(-yMin, 0);

      const chart = new Highcharts.Chart({
        credits: false,
        chart: {
          backgroundColor: 'transparent',
          renderTo: 'tk-net-worth-chart',
        },
        legend: { enabled: false },
        title: { text: '' },
        xAxis: {
          categories: labels,
          labels: {
            style: { color: 'var(--label_primary)' },
          },
        },
        yAxis: {
          title: { text: '' },
          labels: {
            formatter: function () {
              return formatCurrency(this.value);
            },
            style: { color: 'var(--label_primary)' },
          },
          min: yMin,
          max: yMax,
        },
        plotOptions: {
          area: {
            stacking: 'normal',
          },
        },
        series: assetAccounts,
      });
      const debtChart = new Highcharts.Chart({
        credits: false,
        chart: {
          backgroundColor: 'transparent',
          renderTo: 'tk-net-worth-chart-debt-area',
        },
        legend: { enabled: false },
        title: { text: '' },
        xAxis: {
          categories: labels,
          labels: {
            style: { color: 'transparent' },
          },
        },
        yAxis: {
          title: { text: '' },
          labels: {
            formatter: function () {
              return formatCurrency(this.value);
            },
            style: { color: 'transparent' },
          },
          min: yMin,
          max: yMax,
        },
        plotOptions: {
          area: {
            stacking: 'normal',
          },
        },
        series: debtAccounts,
      });
      this.setState({ chart, debtChart });
    }
  };

  _calculateData() {
    if (!this.props.filters) {
      return;
    }

    const accountBalances = new Map();
    const allReportData = {
      assets: [],
      labels: [],
      debts: [],
      netWorths: [],
      debtRatios: [],
      accounts: [],
    };
    const transactions = this.props.allReportableTransactions.slice().sort(sortByGettableDate);

    let lastMonth = null;
    function pushCurrentAccountData() {
      let assets = 0;
      let debts = 0;
      accountBalances.forEach((total) => {
        if (total > 0) {
          assets += total;
        } else {
          debts -= total;
        }
      });

      allReportData.assets.push(assets);
      allReportData.debts.push(debts);
      allReportData.netWorths.push(assets - debts);
      // for debtRatio: if any assets are $0, it will safely display 'Infinity'
      allReportData.debtRatios.push((debts / assets) * 100);
      allReportData.labels.push(localizedMonthAndYear(lastMonth));
      allReportData.accounts.push(new Map(accountBalances));
    }

    transactions.forEach((transaction) => {
      const transactionMonth = transaction.get('date').clone().startOfMonth();
      if (lastMonth === null) {
        lastMonth = transactionMonth;
      }

      // we're on a new month
      if (transactionMonth.toISOString() !== lastMonth.toISOString()) {
        pushCurrentAccountData();
        lastMonth = transactionMonth;
      }

      const transactionAccountId = transaction.get('accountId');
      if (this.props.filters.accountFilterIds.has(transactionAccountId)) {
        return;
      }

      const transactionAmount = transaction.get('amount');
      if (accountBalances.has(transactionAccountId)) {
        accountBalances.set(
          transactionAccountId,
          accountBalances.get(transactionAccountId) + transactionAmount
        );
      } else {
        accountBalances.set(transactionAccountId, transactionAmount);
      }
    });

    if (
      lastMonth &&
      allReportData.labels[allReportData.labels.length - 1] !== localizedMonthAndYear(lastMonth)
    ) {
      pushCurrentAccountData();
    }

    // make sure we have a label for any months which have empty data
    const { fromDate, toDate } = this.props.filters.dateFilter;
    if (transactions.length) {
      let currentIndex = 0;
      const transactionMonth = transactions[0].get('date').clone().startOfMonth();
      const lastFilterMonth = toDate.clone().addMonths(1).startOfMonth();
      while (transactionMonth.isBefore(lastFilterMonth)) {
        if (!allReportData.labels.includes(localizedMonthAndYear(transactionMonth))) {
          const { assets, debts, debtRatios, netWorths, labels, accounts } = allReportData;
          labels.splice(currentIndex, 0, localizedMonthAndYear(transactionMonth));
          assets.splice(currentIndex, 0, assets[currentIndex - 1] || 0);
          debts.splice(currentIndex, 0, debts[currentIndex - 1] || 0);
          debtRatios.splice(currentIndex, 0, debtRatios[currentIndex - 1] || 0);
          netWorths.splice(currentIndex, 0, netWorths[currentIndex - 1] || 0);
          accounts.splice(currentIndex, 0, accountBalances[currentIndex - 1] || new Map());
        }

        currentIndex++;
        transactionMonth.addMonths(1);
      }
    }

    // Net Worth is calculated from the start of time so we need to handle "filters" here
    // rather than using `filteredTransactions` from context.
    const { labels, assets, debts, netWorths, debtRatios, accounts } = allReportData;
    let startIndex = labels.findIndex((label) => label === localizedMonthAndYear(fromDate));
    startIndex = startIndex === -1 ? 0 : startIndex;
    let endIndex = labels.findIndex((label) => label === localizedMonthAndYear(toDate));
    endIndex = endIndex === -1 ? labels.length + 1 : endIndex + 1;

    const filteredLabels = labels.slice(startIndex, endIndex);
    const filteredDebts = debts.slice(startIndex, endIndex);
    const filteredAssets = assets.slice(startIndex, endIndex);
    const filteredDebtRatios = debtRatios.slice(startIndex, endIndex);
    const filteredNetWorths = netWorths.slice(startIndex, endIndex);
    const filteredAccountBalances = accounts.slice(startIndex, endIndex);

    // Create maps between account IDs and their labels and position in the series array
    const accountLabels = new Map();
    const accountSeriesIds = new Map();
    [
      this._accountsCollection.getOnBudgetAccounts(),
      this._accountsCollection.getTrackingAccounts(),
      this._accountsCollection.getClosedAccounts(),
    ].forEach((accountList) => {
      accountList.forEach((account) => {
        accountLabels.set(account.entityId, account.accountName);

        if (!accountSeriesIds.has(account.entityId)) {
          accountSeriesIds.set(account.entityId, accountSeriesIds.size);
        }
      });
    });

    // Transform from array of maps containing (id => balance)
    // to an array of objects containing (label + array of balances)
    const assetAccounts = [];
    const debtAccounts = [];

    accountSeriesIds.forEach((index, id) => {
      assetAccounts.push({
        type: 'area',
        name: accountLabels.get(id),
        data: Array(labels.length).fill(0),
        color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
      });
      debtAccounts.push({
        type: 'area',
        name: accountLabels.get(id) + ' (Debt)',
        data: Array(labels.length).fill(0),
        color: PIE_CHART_COLORS[index % PIE_CHART_COLORS.length],
      });
    });

    filteredAccountBalances.forEach((monthAccounts, month) => {
      monthAccounts.forEach((balance, id) => {
        const seriesId = accountSeriesIds.get(id);

        if (balance > 0) {
          assetAccounts[seriesId].data[month] = balance;
        } else {
          debtAccounts[seriesId].data[month] = balance;
        }
      });
    });

    this.setState(
      {
        hoveredData: {
          label: labels[labels.length - 1] || '',
          assets: assets[assets.length - 1] || 0,
          debts: debts[debts.length - 1] || 0,
          debtRatio: debtRatios[debtRatios.length - 1] || 0,
          netWorth: netWorths[netWorths.length - 1] || 0,
        },
        reportData: {
          labels: filteredLabels,
          debts: filteredDebts,
          assets: filteredAssets,
          netWorths: filteredNetWorths,
          debtRatios: filteredDebtRatios,
          assetAccounts: assetAccounts,
          debtAccounts: debtAccounts,
        },
      },
      this._renderReport
    );
  }
}
