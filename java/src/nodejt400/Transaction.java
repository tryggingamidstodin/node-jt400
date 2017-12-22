package nodejt400;

import java.sql.Connection;

public class Transaction implements ConnectionProvider
{

	private final ConnectionProvider connectionProvider;
	private final Connection connection;

	private final JdbcJsonClient client;

	public Transaction(ConnectionProvider connectionProvider) throws Exception
	{
		this.connectionProvider = connectionProvider;
		this.connection = connectionProvider.getConnection();
		this.connection.setAutoCommit(false);
		this.client = new JdbcJsonClient(this);
	}

	public void commit() throws Exception
	{
		this.connection.commit();
	}

	public void rollback() throws Exception
	{
		this.connection.rollback();
	}

	public void end() throws Exception
	{
		this.connection.setAutoCommit(true);
		this.connectionProvider.returnConnection(this.connection);
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
	}

	public StatementWrap execute(String sql, String paramsJson)
		throws Exception
	{
			return client.execute(sql, paramsJson);
	}

	public TablesReadStream getTablesAsStream(String catalog, String schema, String table) throws Exception
	{
		return client.getTablesAsStream(catalog, schema, table);
	}

	public String getColumns(String catalog, String schema, String tableNamePattern, String columnNamePattern)
			throws Exception
	{
		return client.getColumns(catalog, schema, tableNamePattern, columnNamePattern);
	}

	public int update(String sql, String paramsJson)
			throws Exception
	{
		return client.update(sql, paramsJson);
	}

	public double insertAndGetId(String sql, String paramsJson)
			throws Exception
	{
		return client.insertAndGetId(sql, paramsJson);
	}

	public int[] batchUpdate(String sql, String paramsListJson)
			throws Exception 
	{
		return client.batchUpdate(sql, paramsListJson);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return connection;
	}

	@Override
	public void returnConnection(Connection c) throws Exception
	{
		connectionProvider.returnConnection(connection);
	}

	@Override
	public void close(){
		try{
			connectionProvider.returnConnection(connection);
		}catch(Exception ex){
			ex.printStackTrace();
		}
	}
}
