package nodejt400;

import java.sql.Connection;
import java.sql.DriverManager;

import org.hsqldb.jdbc.JDBCDriver;

public class HsqlClient implements ConnectionProvider
{
	private final JdbcJsonClient client;

	public HsqlClient() throws Exception
	{
		DriverManager.registerDriver(new JDBCDriver());
		client = new JdbcJsonClient(this);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return DriverManager.getConnection("jdbc:hsqldb:mem:test", "quser", "");
	}

	@Override
	public void returnConnection(Connection c) throws Exception
	{
		c.close();
	}

	@Override
	public void close(){
	}

	public String query(String sql, String paramsJson)
			throws Exception
	{
		return client.query(sql, paramsJson);
	}

	public ResultStream queryAsStream(String sql, String paramsJson,
			int bufferSize) throws Exception {
		return client.queryAsStream(sql, paramsJson, bufferSize);
	}

	public int[] batchUpdate(String sql, String paramsListJson)
			throws Exception {
		return client.batchUpdate(sql, paramsListJson);
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
	public String getPrimaryKeys(String catalog, String schema, String table)
	throws Exception
	{
		return client.getPrimaryKeys(catalog, schema, table);
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

	public Transaction createTransaction() throws Exception
	{
		return new Transaction(getConnection());
	}

	public KeyedDataQ createKeyedDataQ(String name)throws Exception
	{
		return null;
	}

	public IfsReadStream createIfsReadStream(String fileName) throws Exception {
		return null;
	}

	/**
	 * Mock program call
	 * @param programName
	 * @param paramsSchemaJsonStr
	 * @return
	 */
	public Pgm pgm(String programName, String paramsSchemaJsonStr)
	{
		return new Pgm(programName, paramsSchemaJsonStr);
	}

	public class Pgm
	{
		public Pgm(String programName, String paramsSchemaJsonStr)
		{
		}

		public String run(String paramsJsonStr)
		{
			return paramsJsonStr;
		}
	}
}
