package nodejt400;

import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Properties;

import com.ibm.as400.access.*;
import org.json.simple.JSONObject;
import org.json.simple.JSONValue;

public class JT400
{
	private final ConnectionProvider connectionProvider;

	private final JdbcJsonClient client;

	public JT400(ConnectionProvider connectionProvider)
	{
		this.connectionProvider = connectionProvider;
		this.client = new JdbcJsonClient(connectionProvider);
	}
	public static final JT400 createConnection(String jsonConf)
	throws Exception
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new JT400(new SimpleConnection(conf));
	}

	public static final JT400 createPool(String jsonConf)
	{
		JSONObject conf = (JSONObject) JSONValue.parse(jsonConf);
		return new JT400(new Pool(conf));
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
		return new Transaction(connectionProvider);
	}

	public Pgm pgm(String programName, String paramsSchemaJsonStr, String libraryName, Integer ccsid)
	{
		return new Pgm(connectionProvider, programName, paramsSchemaJsonStr, libraryName, ccsid);
	}

	public MessageQ openMessageQ(String name , Boolean isPath) throws Exception {
		return new MessageQ(connectionProvider, name, isPath);
	}

	public DataQ createDataQ(String path) throws Exception
	{
		return new DataQ(connectionProvider, path);
	}

	public KeyedDataQ createKeyedDataQ(String name) throws Exception
	{
		return new KeyedDataQ(connectionProvider, name);
	}
	
	public MessageFileHandler openMessageFile(String path) throws Exception
	{
		return new MessageFileHandler(connectionProvider,path);
	}

	public IfsReadStream createIfsReadStream(String fileName) throws Exception {
		return new IfsReadStream(connectionProvider, fileName);
	}

	public IfsWriteStream createIfsWriteStream(String folderPath, String fileName, boolean append, Integer ccsid) throws Exception {
		return new IfsWriteStream(connectionProvider, folderPath, fileName, append, ccsid);
	}
	
	public boolean deleteIfsFile(String fileName) throws Exception {
		Connection connection = connectionProvider.getConnection();
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
		AS400 as400 = handle.getSystem();
		IFSFile file = new IFSFile(as400, fileName);
		boolean res = file.delete();
		connectionProvider.returnConnection(connection);
		return res;
	}

	public String getIfsFileMetadata(String fileName) throws Exception {
		Connection connection = connectionProvider.getConnection();
		AS400JDBCConnectionHandle handle = (AS400JDBCConnectionHandle) connection;
		AS400 as400 = handle.getSystem();
		IFSFile file = new IFSFile(as400, fileName);
		JSONObject metadata = new JSONObject();
		metadata.put("length", file.length());
		metadata.put("exists", file.exists());
		connectionProvider.returnConnection(connection);
		return metadata.toJSONString();
	}

	public void close()
	{
		connectionProvider.close();
	}

}

class SimpleConnection implements ConnectionProvider
{
	private final Connection connection;
	private final JSONObject jsonConf;
	private AS400 as400;

	public SimpleConnection(JSONObject jsonConf)  throws Exception
	{
		Connection conn = null;
		this.jsonConf = jsonConf;
    	Properties connectionProps = new Properties();
    	connectionProps.putAll(jsonConf);

		DriverManager.registerDriver(new AS400JDBCDriver());
    	connection = DriverManager.getConnection("jdbc:as400://" + jsonConf.get("host"), connectionProps);
	}

	@Override
	public Connection getConnection() throws Exception
	{
		return connection;
	}

	@Override
	public AS400 getAS400Connection() throws Exception {
		as400 = new AS400((String) jsonConf.get("host"),
				(String) jsonConf.get("user"),
				(String) jsonConf.get("password"));
		as400.setGuiAvailable(false);
		as400.connectService(AS400.COMMAND);

		return as400;
	}

	@Override
	public void returnConnection(Connection c) throws Exception
	{
	}

	@Override
	public void close()
	{
		try
		{
			connection.close();

			if ((as400 != null && as400.isConnected())) {
				as400.disconnectAllServices();
			}
		}
		catch(Exception ex)
		{
			ex.printStackTrace();
		}
	}
}

class Pool implements ConnectionProvider
{
	private final AS400JDBCConnectionPool sqlPool;
	private final long logConnectionTimeThreshold;
	private final JSONObject jsonConf;
	private AS400 as400;

	public Pool(JSONObject jsonConf)
	{
		this.jsonConf = jsonConf;

		Properties connectionProps = new Properties();
		connectionProps.putAll(jsonConf);
		connectionProps.remove("host");
		connectionProps.remove("user");
		connectionProps.remove("password");

		String conTimeThresshold = System.getenv("LOG_CONNECTION_TIME_THRESHOLD");
		if(conTimeThresshold == null) {
			conTimeThresshold = "10000";
		}
		logConnectionTimeThreshold = Long.parseLong(conTimeThresshold);

		//DB2 Pool
		AS400JDBCConnectionPoolDataSource ds = new AS400JDBCConnectionPoolDataSource();
		ds.setServerName((String) jsonConf.get("host"));
		ds.setUser((String) jsonConf.get("user"));
		ds.setPassword((String) jsonConf.get("password"));
		ds.setProperties(connectionProps);
		this.sqlPool = new AS400JDBCConnectionPool(ds);

		Runtime.getRuntime().addShutdownHook(new Thread()
		{
			@Override
			public void run()
			{
				System.out.println("close connectionpool.");
				sqlPool.close();
			}
		});
	}

	@Override
	public Connection getConnection() throws Exception
	{
		long t = System.currentTimeMillis();
		Connection c = sqlPool.getConnection();
		t = System.currentTimeMillis() - t;
		if(t >= logConnectionTimeThreshold) {
			System.out.println("Connect time: " + t);
		}
		return c;
	}

	@Override
	public AS400 getAS400Connection() throws Exception {
		as400 = new AS400((String) jsonConf.get("host"),
				(String) jsonConf.get("user"),
				(String) jsonConf.get("password"));
		as400.setGuiAvailable(false);
		as400.connectService(AS400.COMMAND);

		return as400;
	}

	@Override
	public void returnConnection(Connection c) throws Exception
	{
		c.close();
	}

	@Override
	public void close()
	{
		try
		{
			sqlPool.close();

			if ((as400 != null && as400.isConnected())) {
				as400.disconnectAllServices();
			}
		} catch (Exception ex) {

		}
	}
}